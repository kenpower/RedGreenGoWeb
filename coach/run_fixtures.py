"""Offline check of the AI coach against hand-written fixtures.

Each fixture in coach/fixtures/*.toml describes one step a pair might take
and what the coach should say about it. This script sends each one to the
model and compares the verdict with the fixture's [expect] table.

Usage:
    pip install anthropic
    python coach/run_fixtures.py              # all fixtures
    python coach/run_fixtures.py 03 07        # fixtures whose name starts with 03 or 07

Needs ANTHROPIC_API_KEY. Results are also saved to coach/results/.
"""
import datetime
import json
import re
import sys
import tomllib
from pathlib import Path

import anthropic

from coach import EFFORT, MODEL, ask_coach, validate

HERE = Path(__file__).parent
# Shapes of real code, not prose: braces, operators, a call, a GoogleTest macro,
# a statement ending in ';'. A bare name in a sentence ("a new function, say
# fizzBuzz", std::invalid_argument) is fine; fizzBuzz(1) or EXPECT_EQ is not.
CODE_LIKE = re.compile(
    r"[{}]|==|!=|->|<<|#include|\)\s*;|\breturn\s+[^\s.,;]+\s*;"
    r"|\b[A-Za-z_]\w*\([^)]*\)|\b(?:EXPECT|ASSERT)_[A-Z]+\b|\bTEST(?:_F|_P)?\b")
SHOWN = ("note", "driver_action", "navigator_action", "next_test", "hint_question", "hint_kind",
         "smell_question", "smell_detail")
# A second instruction joined on: "... and make ...", "...; then run ...".
SECOND_TASK = re.compile(
    r";|\b(and|then)\s+(then\s+)?(make|write|add|run|fix|change|check|uncomment|comment|remove|rename|delete|"
    r"create|commit|build|keep|put|move|replace|extract|split|undo|revert|go|start|update|set)\b",
    re.IGNORECASE)
MAX_ACTION_WORDS = 24  # the "new function, say X, ...: the compile error counts as Red" move needs a few more


def single_action(text):
    return len(text.split()) <= MAX_ACTION_WORDS and not SECOND_TASK.search(text)


# The specifics of an answer: quoted values, numbers, and code-like names
# (CamelCase, snake_case or containing digits), e.g. DifferentArtistNotEqual, "IV", 15.
QUOTED = re.compile(r"\"[^\"]+\"|'[^']+'")
SPECIFIC = re.compile(r"\b(?:[a-z]+[A-Z]\w*|[A-Z][a-z]+[A-Z]\w*|\w*_\w+|\w*\d\w*)\b")


def answer_specifics(*texts):
    found = set()
    for text in texts:
        found.update(q.strip("\"'").lower() for q in QUOTED.findall(text))
        found.update(s.lower() for s in SPECIFIC.findall(text))
    return {s for s in found if s}


TEST_NAME = re.compile(r"\bTEST(?:_F|_P)?\s*\(\s*\w+\s*,\s*(\w+)\s*\)")


def hint_leaks(verdict, step):
    """Specifics of the answer (driver_action, next_test) that appear in hint_question.
    Names from the problem statement or already in their production code (e.g.
    the function under test) are context, not the answer; so are the tests
    themselves on Green and Refactor, where
    the test being worked on is already known."""
    question = verdict["hint_question"].lower()
    context = answer_specifics(step.get("problem", ""), step.get("code", ""))
    if step["phase"] in ("green", "refactor"):
        context |= {name.lower() for name in TEST_NAME.findall(step.get("tests", ""))}
    return sorted(s for s in answer_specifics(verdict["driver_action"], verdict["next_test"]) - context
                  if re.search(r"(?<!\w)" + re.escape(s) + r"(?!\w)", question))


def score(verdict, expect, step):
    """Return a list of (field, ok, detail): the fixture's [expect] checks, plus
    the ones that apply to every fixture."""
    phase = step["phase"]
    checks = []
    if "decision" in expect:
        checks.append(("decision", verdict["decision"] in expect["decision"], verdict["decision"]))
    for field in ("likely_finished", "advice"):
        if field in expect:
            checks.append((field, verdict[field] == expect[field], verdict[field]))
    if "next_test_known" in expect:
        known = bool(verdict["next_test"].strip())
        checks.append(("next_test_known", known == expect["next_test_known"], verdict["next_test"] or '""'))
    if "max_problems" in expect:
        count = len(verdict["rule_problems"])
        checks.append(("max_problems", count <= expect["max_problems"], count))
    # The driver's one action must mention one of these, and none of the avoided words.
    driver = verdict["driver_action"].lower()
    if "driver_mentions" in expect:
        hit = any(w.lower() in driver for w in expect["driver_mentions"])
        checks.append(("driver_mentions", hit, verdict["driver_action"]))
    if "driver_avoids" in expect:
        found = [w for w in expect["driver_avoids"] if w.lower() in driver]
        checks.append(("driver_avoids", not found, ", ".join(found) or "none"))
    checks.append(("single_action", single_action(verdict["driver_action"]), verdict["driver_action"] or '""'))

    # Anything the pair reads (note and both actions) must / mustn't mention these.
    shown = " ".join(verdict[f] for f in ("note", "driver_action", "navigator_action")).lower()
    if "says" in expect:
        checks.append(("says", any(w.lower() in shown for w in expect["says"]), verdict["note"]))
    if "not_says" in expect:
        found = [w for w in expect["not_says"] if w.lower() in shown]
        checks.append(("not_says", not found, ", ".join(found) or "none"))

    if "intent_match" in expect:
        checks.append(("intent_match", verdict["intent_match"] in expect["intent_match"], verdict["intent_match"]))

    # The hint ladder: a real question that doesn't give the answer away, and a
    # kind with no specifics. Not needed once Finish is agreed, or when the
    # fixture says there should be none (stale results: just run the tests).
    if expect.get("hints", True) and not (phase == "finish" and verdict["decision"] == "advance"):
        question = verdict["hint_question"].strip()
        checks.append(("hint_is_question", question.endswith("?"), question or '""'))
        leaks = hint_leaks(verdict, step)
        checks.append(("hint_no_answer", not leaks, ", ".join(leaks) or "none"))
        kind = verdict["hint_kind"]
        vague = bool(kind.strip()) and not QUOTED.search(kind) and not re.search(r"\d", kind) and not CODE_LIKE.search(kind)
        checks.append(("hint_kind_vague", vague, kind or '""'))

    # Smells belong only to an advancing Green; the fixture may say whether one is expected.
    smell = bool(verdict["smell_question"].strip() or verdict["smell_detail"].strip())
    if phase == "green" and verdict["decision"] == "advance":
        if "smell" in expect:
            checks.append(("smell", smell == expect["smell"], verdict["smell_question"] or '""'))
        if smell:
            both = bool(verdict["smell_question"].strip() and verdict["smell_detail"].strip())
            checks.append(("smell_complete", both, "both" if both else "one missing"))
    else:
        checks.append(("smell_only_on_green", not smell, verdict["smell_question"] or "none"))

    # A held pair must be told what to do; nothing the pair sees may contain code.
    if verdict["decision"] != "advance" or phase != "finish":
        has_actions = bool(verdict["driver_action"].strip() and verdict["navigator_action"].strip())
        checks.append(("actions", has_actions, "present" if has_actions else "missing"))
    leaks = [f for f in SHOWN if CODE_LIKE.search(verdict[f])]
    checks.append(("no_code", not leaks, ", ".join(leaks) or "none"))
    return checks


def main(prefixes):
    files = sorted((HERE / "fixtures").glob("*.toml"))
    if prefixes:
        files = [f for f in files if any(f.stem.startswith(p) for p in prefixes)]

    client = anthropic.Anthropic()
    results, passed, input_tokens, output_tokens, cache_written, cache_read = [], 0, 0, 0, 0, 0

    for f in files:
        fx = tomllib.loads(f.read_text(encoding="utf-8"))
        expect = fx.pop("expect")
        description = fx.pop("description")
        validate(fx)  # fixtures must be valid server requests too
        try:
            verdict, usage = ask_coach(client, fx)
        except (anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.BadRequestError) as e:
            # Same for every fixture (bad key, no credit, bad request shape), so stop here.
            print(f"ERROR {f.stem}: {e}\nStopping: this would fail the same way for every fixture.")
            return
        except (anthropic.APIError, RuntimeError, json.JSONDecodeError) as e:
            print(f"ERROR {f.stem}: {e}\n")
            results.append({"fixture": f.stem, "error": str(e)})
            continue

        input_tokens += usage.input_tokens
        output_tokens += usage.output_tokens
        cache_written += usage.cache_creation_input_tokens or 0
        cache_read += usage.cache_read_input_tokens or 0
        checks = score(verdict, expect, fx)
        ok = all(c[1] for c in checks)
        passed += ok

        print(f"{'PASS' if ok else 'FAIL'} {f.stem}  ({description})")
        for field, field_ok, got in checks:
            if field_ok and field in ("actions", "no_code", "single_action", "hint_is_question", "hint_no_answer",
                                      "hint_kind_vague", "smell_complete", "smell_only_on_green"):
                continue  # only worth a line when they fail
            mark = "  " if field_ok else "!!"
            print(f"   {mark} {field}: {got}   expected {expect.get(field, 'ok')}")
        if verdict["rule_problems"]:
            print(f"      problems: {'; '.join(verdict['rule_problems'])}")
        print(f"      note:      {verdict['note']}")
        print(f"      driver:    {verdict['driver_action']}")
        print(f"      navigator: {verdict['navigator_action']}")
        print(f"      next test: {verdict['next_test'] or '-'}")
        print(f"      hint:      {verdict['hint_question']}  /  {verdict['hint_kind']}")
        if verdict["smell_question"] or verdict["smell_detail"]:
            print(f"      smell:     {verdict['smell_question']}  /  {verdict['smell_detail']}")
        if verdict["intent_match"] != "n_a":
            print(f"      intent:    {verdict['intent_match']}")
        print()
        results.append({"fixture": f.stem, "pass": ok, "checks": checks, "verdict": verdict})

    print(f"{passed}/{len(files)} passed. Tokens: {input_tokens} uncached in, {cache_written} cache written, "
          f"{cache_read} cache read, {output_tokens} out ({MODEL}, effort {EFFORT}).")

    out = HERE / "results"
    out.mkdir(exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    (out / f"{stamp}.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1:])
