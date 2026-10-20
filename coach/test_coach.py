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


if __name__ == "__main__":
    unittest.main()
