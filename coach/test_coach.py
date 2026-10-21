"""Unit tests for coach.ask_coach's calls, with a fake client (no API key, no network).

Run from the coach folder:  python -m unittest test_coach
"""
import json
import unittest
from types import SimpleNamespace

import coach

VERDICT = {"decision": "redo", "rule_problems": ["extra code"], "note": "Take out the extra code.",
           "driver_action": "Remove the Buzz branch.", "navigator_action": "Check only Fizz is left.",
           "next_test": "", "likely_finished": False, "advice": False, "intent_match": "n_a",
           "hint_question": "Which lines does no test ask for?", "hint_kind": "untested code",
           "smell_question": "", "smell_detail": "", "rescue_code": "", "rescue_why": ""}
GUIDANCE = {"steps": [{"id": "green.remove_extra", "detail": "Delete the Buzz branch in fizzBuzz."},
                      {"id": "green.run_tests", "detail": "Keep only std::to_string(n)."}],
            "extra": "", "extra_needed": False, "on_track": False}
CATALOGUE = [{"id": "green.remove_extra", "text": "Remove code no test asks for"},
             {"id": "green.run_tests", "text": "Run all the tests"}]


class FakeClient:
    """Answers the verdict call, then the guidance call, and records each call."""

    def __init__(self):
        self.calls = []
        self.messages = SimpleNamespace(create=self.create)

    def create(self, **kwargs):
        self.calls.append(kwargs)
        guidance = "steps" in kwargs["output_config"]["format"]["schema"]["properties"]
        usage = SimpleNamespace(input_tokens=10, output_tokens=5, cache_creation_input_tokens=0,
                                cache_read_input_tokens=100)
        return SimpleNamespace(stop_reason="end_turn", usage=usage,
                               content=[SimpleNamespace(type="text", text=json.dumps(GUIDANCE if guidance else VERDICT))])


def step(**extra):
    return {"mode": "look", "phase": "green", "problem": "FizzBuzz", "tests": "TEST(F, One) {}",
            "code": "std::string fizzBuzz(int n);", "test_result": "All 1 tests passed",
            "catalogue": CATALOGUE, **extra}


class AskCoach(unittest.TestCase):
    def test_a_look_between_dones_asks_the_verdict_then_the_guidance(self):
        client = FakeClient()
        answer, usage = coach.ask_coach(client, step(done=False))
        self.assertEqual(len(client.calls), 2)
        self.assertNotIn("Catalogue", client.calls[0]["messages"][0]["content"])  # the verdict never sees it
        self.assertIn("Take out the extra code.", client.calls[1]["messages"][0]["content"])  # the guidance does see the verdict
        self.assertEqual(answer["decision"], "redo")
        self.assertEqual([s["id"] for s in answer["steps"]], ["green.remove_extra", "green.run_tests"])
        self.assertEqual(answer["steps"][1]["detail"], "")  # a detail with code is blanked
        self.assertEqual((usage.input_tokens, usage.output_tokens, usage.cache_read_input_tokens), (20, 10, 200))

    def test_a_done_look_makes_exactly_one_model_call_the_verdict(self):
        client = FakeClient()
        answer, usage = coach.ask_coach(client, step(done=True))
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(client.calls[0]["system"][0]["text"], coach.build_system("prompt.md"))
        self.assertEqual(answer["decision"], "redo")
        self.assertEqual((answer["steps"], answer["extra"], answer["on_track"]), ([], "", True))
        self.assertEqual(usage.output_tokens, 5)

    def test_the_eval_can_still_ask_for_a_done_looks_guidance(self):
        client = FakeClient()
        answer, _ = coach.ask_coach(client, step(done=True), guidance=True)
        self.assertEqual(len(client.calls), 2)
        self.assertEqual(len(answer["steps"]), 2)

    def test_without_a_catalogue_only_the_verdict_is_asked(self):
        client = FakeClient()
        answer, _ = coach.ask_coach(client, step(phase="finish", catalogue=None))
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(answer["steps"], [])


class Orient(unittest.TestCase):
    BRIEF = {"building": "FizzBuzz: numbers as text, Fizz for 3s.", "code_state": "scaffold",
             "warnings": [" A placeholder test is still there. ", "", "a", "b", "c"], "first_move": "Test that 1 gives '1'."}

    def test_orient_is_one_call_with_its_own_prompt_and_schema(self):
        client = FakeClient()
        original = client.create  # records the call; the answer is the brief

        def create(**kwargs):
            original(**kwargs)
            return SimpleNamespace(stop_reason="end_turn", usage=SimpleNamespace(input_tokens=1, output_tokens=1),
                                   content=[SimpleNamespace(type="text", text=json.dumps(self.BRIEF))])
        client.messages = SimpleNamespace(create=create)
        brief, _ = coach.ask_coach(client, step(mode="orient", phase="red", catalogue=None))
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(client.calls[0]["system"][0]["text"], coach.build_system("orient.md"))
        self.assertEqual(client.calls[0]["output_config"]["format"]["schema"], coach.ORIENT_SCHEMA)
        self.assertEqual(brief["warnings"], ["A placeholder test is still there.", "a", "b"])  # trimmed, at most 3
        self.assertEqual(brief["code_state"], "scaffold")

    def test_building_goes_with_every_later_call(self):
        later = step(building="A word counter for sentences.")
        self.assertIn("What the pair is building (agreed at the start of the game): A word counter",
                      coach.build_user(later))
        self.assertIn("A word counter", coach.build_guidance_user(later, VERDICT))
        self.assertNotIn("agreed at the start", coach.build_user(step()))
        with self.assertRaises(coach.BadStep):
            coach.validate(step(building="x" * 501))
        coach.validate(step(mode="orient", catalogue=None))


class MoveReview(unittest.TestCase):
    def test_refactor_guidance_reviews_the_change_since_the_checkpoint(self):
        client = FakeClient()
        refactor = step(phase="refactor", checkpoint={"tests": "TEST(F, One) {}", "code": "int old();"})
        coach.ask_coach(client, refactor)
        guidance_call = client.calls[1]
        self.assertIn("move_review", guidance_call["output_config"]["format"]["schema"]["properties"])
        user = guidance_call["messages"][0]["content"]
        self.assertIn("Production code at the checkpoint", user)
        self.assertIn("int old();", user)
        self.assertNotIn("Tests at the checkpoint", user)  # unchanged tests aren't repeated
        # other phases: no review
        client = FakeClient()
        coach.ask_coach(client, step(phase="green"))
        self.assertNotIn("move_review", client.calls[1]["output_config"]["format"]["schema"]["properties"])

    def test_the_review_is_cleaned(self):
        cleaned = coach._clean_steps({"steps": [], "extra": "", "extra_needed": False, "on_track": True, "move_review": {
            "refactoring": " Extract Function ", "effect": "better", "behaviour_kept": True,
            "note": "Now calls helper(n) once."}}, {"catalogue": CATALOGUE})
        self.assertEqual(cleaned["move_review"],
                         {"refactoring": "Extract Function", "effect": "better", "behaviour_kept": True, "note": ""})
        nothing = coach._clean_steps({"steps": [], "move_review": {"refactoring": "Rename", "effect": "none",
                                                                   "behaviour_kept": True, "note": ""}},
                                     {"catalogue": CATALOGUE})
        self.assertEqual(nothing["move_review"]["refactoring"], "")  # nothing changed: no name
        self.assertNotIn("move_review", coach._clean_steps({"steps": []}, {"catalogue": CATALOGUE}))

    def test_the_checkpoint_is_checked(self):
        coach.validate(step(checkpoint={"tests": "", "code": "int f();"}))
        for bad in ({"code": 3}, {"code": "x", "other": ""}, "int f();", {"code": "x" * 10_001}):
            with self.assertRaises(coach.BadStep, msg=bad):
                coach.validate(step(checkpoint=bad))


class Lab(unittest.TestCase):
    REFACTORINGS = ["Extract Function", "Rename Variable"]
    BOARD = [{"id": "long-price", "where": "priceFor", "what": "Too long.", "refactoring": "Extract Function"}]

    def answering(self, answer):
        client = FakeClient()

        def create(**kwargs):
            client.calls.append(kwargs)
            return SimpleNamespace(stop_reason="end_turn", usage=SimpleNamespace(input_tokens=1, output_tokens=1),
                                   content=[SimpleNamespace(type="text", text=json.dumps(answer))])
        client.messages = SimpleNamespace(create=create)
        return client

    def test_lab_orient_lists_a_smell_board_from_the_labs_refactorings(self):
        client = self.answering({**Orient.BRIEF, "smells": [
            {"id": "Long Price!", "where": "priceFor", "what": "Too long.", "refactoring": "Extract Function"},
            {"id": "long-price", "where": "x", "what": "dup id", "refactoring": "Extract Function"},
            {"id": "other", "where": "x", "what": "not this lab's", "refactoring": "Inline Function"}]})
        brief, _ = coach.ask_coach(client, step(mode="orient", catalogue=None, lab="refactor",
                                                refactorings=self.REFACTORINGS))
        self.assertEqual(client.calls[0]["system"][0]["text"], coach.build_system("lab_orient.md"))
        enum = client.calls[0]["output_config"]["format"]["schema"]["properties"]["smells"]["items"]["properties"]["refactoring"]["enum"]
        self.assertEqual(enum, self.REFACTORINGS)
        self.assertEqual([s["id"] for s in brief["smells"]], ["long-price"])  # cleaned, unique, the lab's only

    def test_a_lab_look_is_one_call_reviewing_the_change_against_the_board(self):
        client = self.answering({"decision": "advance", "note": "Good.", "smells_resolved": ["long-price", "nope"],
                                 "move_review": {"refactoring": "Extract Function", "effect": "better",
                                                 "behaviour_kept": True, "note": ""},
                                 "hint_question": "Q?", "hint_kind": "k", "driver_action": "a",
                                 "commit_message": "Extract Function: lineTotal", "rescue_code": "x", "rescue_why": "y"})
        answer, _ = coach.ask_coach(client, step(lab="refactor", refactorings=self.REFACTORINGS, board=self.BOARD,
                                                 lab_phase="test", catalogue=None, code_before="int old();"))
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(client.calls[0]["system"][0]["text"], coach.build_system("lab.md"))
        user = client.calls[0]["messages"][0]["content"]
        self.assertIn("[long-price] priceFor", user)
        self.assertIn("Production code at the last commit", user)
        self.assertEqual(answer["smells_resolved"], ["long-price"])  # board ids only
        self.assertEqual(answer["move_review"]["refactoring"], "Extract Function")
        self.assertEqual((answer["rescue_code"], answer["rescue_why"]), ("", ""))  # no RESCUE asked

    def test_lab_fields_are_checked(self):
        coach.validate(step(lab="refactor", refactorings=self.REFACTORINGS, board=self.BOARD, lab_phase="commit"))
        for bad in ({"lab": "tdd", "refactorings": self.REFACTORINGS}, {"lab": "refactor", "refactorings": []},
                    {"lab": "refactor", "refactorings": self.REFACTORINGS, "lab_phase": "red"},
                    {"lab": "refactor", "refactorings": self.REFACTORINGS, "board": [{"id": "x"}]}):
            with self.assertRaises(coach.BadStep, msg=bad):
                coach.validate(step(**bad))


class Struggle(unittest.TestCase):
    def test_the_struggle_signals_are_checked(self):
        good = {"runs_without_progress": 2, "minutes_on_step": 6, "holds_on_step": 1, "hints_shown": 2,
                "novice": False, "rung": 3}
        coach.validate(step(struggle=good))
        coach.validate(step(struggle={}))
        for bad in ({"rung": 0}, {"rung": 4}, {"runs_without_progress": -1}, {"minutes_on_step": 1.5},
                    {"novice": "yes"}, {"hints_shown": True}, {"other": 1}, ["rung", 1]):
            with self.assertRaises(coach.BadStep, msg=bad):
                coach.validate(step(struggle=bad))

    def test_the_guidance_follows_the_rung_and_novices_always_get_rung_3(self):
        user = lambda **s: coach.build_guidance_user(step(**s), VERDICT)
        self.assertIn("Hint rung for the details: 1. Point at where to look", user(struggle={"rung": 1}))
        self.assertIn("Hint rung for the details: 3.", user(struggle={"rung": 1}, novice=True))
        self.assertIn("Hint rung for the details: 3.", user())  # no signals: as specific as before
        self.assertIn("run the tests 2 times on this step without getting closer",
                      user(struggle={"rung": 2, "runs_without_progress": 2}))
        # the verdict call never sees the rung: it fills every rung of its ladder
        self.assertNotIn("Hint rung", coach.build_user(step(struggle={"rung": 1})))


if __name__ == "__main__":
    unittest.main()
