"""Offline check of the AI coach against hand-written fixtures.

Each fixture in coach/fixtures/*.toml describes one step a pair might take
and what the coach should say about it. This script sends each one to the
model and compares the verdict with the fixture's [expect] table.

Usage:
    pip install anthropic
    python coach/run_fixtures.py              # all fixtures, 8 at a time
    python coach/run_fixtures.py 03 07        # fixtures whose name starts with 03 or 07
    python coach/run_fixtures.py --runs 3     # three full runs at once (one results file each)
    python coach/run_fixtures.py --workers 4  # fewer requests at once (e.g. a low rate limit)

Output is in fixture order whatever order the answers arrive in.

Needs ANTHROPIC_API_KEY. Results are also saved to coach/results/.
"""
import argparse
import datetime
import json
import re
import subprocess
import sys
import threading
import time
import tomllib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import anthropic

from coach import DETAIL_CODE_LIKE, EFFORT, MODEL, ask_coach, validate

HERE = Path(__file__).parent
ROOT = HERE.parent
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
MAX_RESCUE_LINES = 15
MAX_ACTION_WORDS = 24  # the "new function, say X, ...: the compile error counts as Red" move needs a few more


# Next-steps details may name identifiers and short literals ("add #include
# "fizz.hpp"", "test 3, expecting Fizz"), but not code (DETAIL_CODE_LIKE, from coach.py,
# which blanks such details).
MAX_DETAIL_WORDS = 25


def catalogues():
    """The step catalogue per phase, straight from src/content/steps.js."""
    script = ("import('./src/content/steps.js').then(m => console.log(JSON.stringify("
              "Object.fromEntries(['red', 'green', 'refactor'].map(p => [p, m.catalogueFor(p)])))))")
    out = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def score_next_steps(answer, expect, step):
    ids = [s["id"] for s in answer["steps"]]
    # a finished step skips what's done, and back to Red leaves this phase little to
    # do, so either may leave just one useful step
    fewest = expect.get("min_steps", 2 if answer.get("decision") == "redo" else 1)
    checks = [("step_count", fewest <= len(ids) <= 4, len(ids))]
    if "steps_first" in expect:
        checks.append(("steps_first", bool(ids) and ids[0] in expect["steps_first"], ids[0] if ids else "none"))
    if "steps_include" in expect:
        checks.append(("steps_include", any(i in ids for i in expect["steps_include"]), ", ".join(ids)))
    if "steps_exclude" in expect:
        found = [i for i in expect["steps_exclude"] if i in ids]
        checks.append(("steps_exclude", not found, ", ".join(found) or "none"))
    details = [s["detail"] for s in answer["steps"]]
    text = " ".join(details)
    for key in ("detail_mentions", "detail_suggests"):
        if key in expect:
            checks.append((key, any(w in text for w in expect[key]), text[:80] or '""'))
    review = answer.get("move_review")
    if "review_effect" in expect:
        checks.append(("review_effect", bool(review) and review["effect"] in expect["review_effect"],
                       review["effect"] if review else "no review"))
    if "review_kept" in expect:
        checks.append(("review_kept", bool(review) and review["behaviour_kept"] == expect["review_kept"],
                       review["behaviour_kept"] if review else "no review"))
    if "review_mentions" in expect:
        said = f"{review['refactoring']} {review['note']}" if review else ""
        checks.append(("review_mentions", any(w.lower() in said.lower() for w in expect["review_mentions"]),
                       said[:80] or '""'))
    if "detail_avoids" in expect:  # a low hint rung: none of these specifics
        said = [w for w in expect["detail_avoids"] if w in text + " " + answer["extra"]]
        checks.append(("detail_avoids", not said, f"{said[0]!r} in: {text[:70]}" if said else "none"))
    if step.get("novice"):
        checks.append(("detail_every_step", all(d.strip() for d in details), f"{sum(bool(d) for d in details)}/{len(details)}"))
    too_long = [d for d in details if len(d.split()) > MAX_DETAIL_WORDS]
    checks.append(("detail_short", not too_long, too_long[0][:60] if too_long else "ok"))
    coded = [d for d in details + [answer["extra"]] if DETAIL_CODE_LIKE.search(d)]
    checks.append(("detail_no_code", not coded, coded[0][:60] if coded else "none"))
    return checks


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
    # an advancing Red's hints are about the coming Green, where the new test is known
    if step["phase"] in ("green", "refactor") or (step["phase"] == "red" and verdict["decision"] == "advance"):
        context |= {name.lower() for name in TEST_NAME.findall(step.get("tests", ""))}
        context |= answer_specifics(step.get("tests", ""))
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

    # Rescue: code only in rescue_code, only when asked, short, for this step.
    code = verdict["rescue_code"].strip()
    if step.get("rescue"):
        lines = [l for l in code.splitlines() if l.strip()]
        plausible = bool(code) and len(lines) <= MAX_RESCUE_LINES and "{" in code and "#include" not in code
        if phase == "red":
            plausible = plausible and "TEST(" in code and code.count("TEST(") == 1
        checks.append(("rescue_code", plausible, f"{len(lines)} lines" if code else '""'))
        checks.append(("rescue_why", bool(verdict["rescue_why"].strip()), verdict["rescue_why"] or '""'))
        if "rescue_mentions" in expect:
            hit = any(w in code for w in expect["rescue_mentions"])
            checks.append(("rescue_mentions", hit, code.splitlines()[0] if code else '""'))
    else:
        checks.append(("no_rescue_code", not code and not verdict["rescue_why"].strip(), code[:40] or "none"))
    return checks


def score_orient(brief, expect):
    """Orient fixtures: the brief's code_state and what its fields name, plus the
    checks for every brief (no code, short)."""
    checks = []
    if "code_state" in expect:
        checks.append(("code_state", brief["code_state"] in expect["code_state"], brief["code_state"]))
    warnings = " ".join(brief["warnings"])
    for key, text in (("building_mentions", brief["building"]), ("first_move_mentions", brief["first_move"]),
                      ("warnings_mention", warnings)):
        if key in expect:
            checks.append((key, any(w.lower() in text.lower() for w in expect[key]), text[:80] or '""'))
    if "warnings_avoid" in expect:
        said = [w for w in expect["warnings_avoid"] if w.lower() in warnings.lower()]
        checks.append(("warnings_avoid", not said, said[0] if said else "none"))
    if expect.get("no_warnings"):
        checks.append(("no_warnings", not brief["warnings"], warnings[:80] or "none"))
    fields = [brief["building"], brief["first_move"], *brief["warnings"]]
    coded = [t for t in fields if CODE_LIKE.search(t)]
    checks.append(("orient_no_code", not coded, coded[0][:60] if coded else "none"))
    checks.append(("first_move_short", len(brief["first_move"].split()) <= 24, brief["first_move"][:60]))
    checks.append(("building_short", len(brief["building"].split()) <= 45, brief["building"][:60]))
    return checks


def score_board(brief, expect, step):
    """A lab Orient: the smell board, the README's steps first, then a few extras
    (preferably the lab's refactorings)."""
    smells = brief.get("smells", [])
    extras = [s for s in smells if not s.get("from_readme")]
    checks = [("smell_count", expect.get("min_smells", 3) <= len(smells) <= 12, len(smells)),
              ("readme_first", all(s.get("from_readme") for s in smells[:len(smells) - len(extras)]), "ok"),
              ("extras_from_lab", sum(s["refactoring"] in step["refactorings"] for s in extras) * 2 >= len(extras),
               ", ".join(s["refactoring"] for s in extras) or "none")]
    if "readme_refactorings" in expect:  # each of these named by a README smell
        named = " ".join(f"{s['refactoring']} {s['what']}" for s in smells if s.get("from_readme")).lower()
        missing = [w for w in expect["readme_refactorings"] if w.lower() not in named]
        checks.append(("readme_refactorings", not missing, ", ".join(missing) or "all"))
    text = " ".join(f"{s['where']} {s['what']}" for s in smells)
    if "smells_mention" in expect:
        missing = [w for w in expect["smells_mention"] if w.lower() not in text.lower()]
        checks.append(("smells_mention", not missing, ", ".join(missing) or "all"))
    if "smells_avoid" in expect:  # e.g. the README's development work, which is never a smell
        said = [w for w in expect["smells_avoid"] if w.lower() in text.lower()]
        checks.append(("smells_avoid", not said, ", ".join(said) or "none"))
    coded = [s["what"] for s in smells if CODE_LIKE.search(s["what"])]
    checks.append(("smell_no_code", not coded, coded[0][:60] if coded else "none"))
    return checks


def score_lab(answer, expect):
    """A lab Look: the decision, the review, the board ticks, the hint and commit message."""
    review = answer["move_review"]
    checks = []
    if "decision" in expect:
        checks.append(("decision", answer["decision"] in expect["decision"], answer["decision"]))
    for key, value in (("review_effect", review["effect"]), ("review_kept", review["behaviour_kept"])):
        if key in expect:
            ok = value in expect[key] if isinstance(expect[key], list) else value == expect[key]
            checks.append((key, ok, value))
    for key, text in (("review_mentions", f"{review['refactoring']} {review['note']}"),
                      ("note_mentions", f"{answer['note']} {review['note']}"),
                      ("driver_mentions", answer["driver_action"]),
                      ("commit_mentions", answer["commit_message"])):
        if key in expect:
            checks.append((key, any(w.lower() in text.lower() for w in expect[key]), text[:80] or '""'))
    if "resolved_include" in expect:
        checks.append(("resolved_include", all(i in answer["smells_resolved"] for i in expect["resolved_include"]),
                       answer["smells_resolved"]))
    if "resolved_empty" in expect:
        checks.append(("resolved_empty", not answer["smells_resolved"], answer["smells_resolved"]))
    if "hints" in expect:
        has = bool(answer["hint_question"].strip() and answer["driver_action"].strip())
        checks.append(("hints", has == expect["hints"], answer["hint_question"] or '""'))
    if answer["driver_action"]:
        checks.append(("single_action", single_action(answer["driver_action"]), answer["driver_action"]))
    coded = [f for f in ("note", "hint_question", "hint_kind", "commit_message") if CODE_LIKE.search(answer[f])]
    coded += ["review note"] if CODE_LIKE.search(review["note"]) else []
    checks.append(("lab_no_code", not coded, ", ".join(coded) or "none"))
    return checks


class Fatal(Exception):
    """Fails the same way for every fixture (bad key, no credit, bad request shape): stop."""


# Checks only worth a line when they fail, per kind of fixture.
QUIET = {
    "orient": ("orient_no_code", "first_move_short", "building_short"),
    "lab": ("lab_no_code", "single_action"),
    "look": ("actions", "no_code", "single_action", "hint_is_question", "hint_no_answer", "hint_kind_vague",
             "smell_complete", "smell_only_on_green", "no_rescue_code", "step_count", "detail_short",
             "detail_no_code", "detail_every_step"),
}


def evaluate(client, f, catalogue):
    """Ask the coach about one fixture and score it: {"record", "lines", "usage"}. The
    lines are printed later, in fixture order, so fixtures can run in threads (nothing
    shared is written here). Raises Fatal."""
    fx = tomllib.loads(f.read_text(encoding="utf-8"))
    expect = fx.pop("expect")
    description = fx.pop("description")
    if fx.get("mode") == "orient":
        kind = "orient"
        fx.setdefault("phase", "red")
    elif fx.get("lab"):  # a refactor-lab Look: one call (coach/lab.md)
        kind = "lab"
        fx.setdefault("mode", "look")
    else:
        # a Look: the guidance from the phase's catalogue, and the verdict. The
        # guidance fixtures (mode = "look") follow a fresh run; the rest are a Done.
        kind = "look"
        fx.setdefault("done", fx.get("mode") != "look")
        fx["mode"] = "look"
        if fx["phase"] != "finish" and "catalogue" not in fx:
            fx["catalogue"] = catalogue[fx["phase"]]
    validate(fx)  # fixtures must be valid server requests too
    with_steps = kind == "look" and fx["phase"] != "finish"
    try:
        # the server skips the guidance for a Done; ask it here too, to score it
        answer, usage = ask_coach(client, fx, guidance=with_steps) if kind == "look" else ask_coach(client, fx)
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.BadRequestError) as e:
        raise Fatal(f"ERROR {f.stem}: {e}") from e
    except (anthropic.APIError, RuntimeError, json.JSONDecodeError) as e:
        return {"record": {"fixture": f.stem, "error": str(e)}, "lines": [f"ERROR {f.stem}: {e}\n"], "usage": None}

    if kind == "orient":
        checks = score_orient(answer, expect) + (score_board(answer, expect, fx) if fx.get("lab") else [])
    elif kind == "lab":
        checks = score_lab(answer, expect)
    else:  # one answer, both halves scored: the verdict, and the guidance steps
        checks = score(answer, expect, fx) + (score_next_steps(answer, expect, fx) if with_steps else [])
    ok = all(c[1] for c in checks)

    lines = [f"{'PASS' if ok else 'FAIL'} {f.stem}  ({description})"]
    lines += [f"   {'  ' if field_ok else '!!'} {field}: {got}   expected {expect.get(field, 'ok')}"
              for field, field_ok, got in checks if not (field_ok and field in QUIET[kind])]
    lines += {"orient": describe_brief, "lab": describe_lab, "look": describe_look}[kind](answer)
    key = "brief" if kind == "orient" else "verdict"
    return {"record": {"fixture": f.stem, "pass": ok, "checks": checks, key: answer}, "lines": lines, "usage": usage}


def describe_brief(brief):
    lines = [f"      building:   {brief['building']}", f"      code:       {brief['code_state']}"]
    lines += [f"      watch out:  {w}" for w in brief["warnings"]]
    lines.append(f"      first move: {brief['first_move']}")
    lines += [f"      smell:      [{s['id']}] {s['where']}: {s['what']} ({s['refactoring']})"
              for s in brief.get("smells", [])]
    return lines + [""]


def describe_review(r):
    return f"      review:    {r['refactoring'] or '-'} / {r['effect']} / kept={r['behaviour_kept']}: {r['note']}"


def describe_lab(answer):
    return [f"      decision:  {answer['decision']}   note: {answer['note']}",
            describe_review(answer["move_review"]),
            f"      resolved:  {answer['smells_resolved']}   commit: {answer['commit_message'] or '-'}",
            f"      hint:      {answer['hint_question']}  /  {answer['hint_kind']}  /  {answer['driver_action']}", ""]


def describe_look(verdict):
    lines = []
    if verdict["rule_problems"]:
        lines.append(f"      problems: {'; '.join(verdict['rule_problems'])}")
    lines += [f"      note:      {verdict['note']}",
              f"      driver:    {verdict['driver_action']}",
              f"      navigator: {verdict['navigator_action']}",
              f"      next test: {verdict['next_test'] or '-'}",
              f"      hint:      {verdict['hint_question']}  /  {verdict['hint_kind']}"]
    if verdict["smell_question"] or verdict["smell_detail"]:
        lines.append(f"      smell:     {verdict['smell_question']}  /  {verdict['smell_detail']}")
    if verdict["intent_match"] != "n_a":
        lines.append(f"      intent:    {verdict['intent_match']}")
    if verdict["rescue_code"]:
        lines.append(f"      rescue:    {verdict['rescue_why']}")
        lines += ["        | " + line for line in verdict["rescue_code"].splitlines()]
    lines.append(f"      on track:  {verdict['on_track']}")
    if verdict.get("move_review"):
        lines.append(describe_review(verdict["move_review"]))
    lines += [f"      [{s['id']}] {s['detail']}" for s in verdict["steps"]]
    if verdict["extra"]:
        lines.append(f"      extra ({'needed' if verdict['extra_needed'] else 'practice'}): {verdict['extra']}")
    return lines + [""]


def main(argv):
    parser = argparse.ArgumentParser(description="Run the coach fixtures against the model.")
    parser.add_argument("prefixes", nargs="*", help="only fixtures whose name starts with one of these")
    parser.add_argument("--workers", type=int, default=8, help="fixtures asked at once (default 8)")
    parser.add_argument("--runs", type=int, default=1, help="full runs, all asked at once (default 1)")
    args = parser.parse_args(argv)

    files = sorted((HERE / "fixtures").glob("*.toml"))
    if args.prefixes:
        files = [f for f in files if any(f.stem.startswith(p) for p in args.prefixes)]
    catalogue = catalogues()  # once, before the threads (it runs node)
    # a stalled request otherwise waits out the SDK's 10-minute default, retried
    client = anthropic.Anthropic(timeout=90)
    stop = threading.Event()

    def job(f):
        if stop.is_set():
            return None
        try:
            return evaluate(client, f, catalogue)
        except Fatal as e:
            stop.set()
            return {"fatal": str(e)}

    started = time.monotonic()
    out = HERE / "results"
    out.mkdir(exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        # every run's fixtures go in at once; each run is then printed in fixture order
        runs = [[pool.submit(job, f) for f in files] for _ in range(max(1, args.runs))]
        for number, futures in enumerate(runs, 1):
            if args.runs > 1:
                print(f"== run {number}", flush=True)
            results, passed, tokens = [], 0, {"in": 0, "out": 0, "written": 0, "read": 0}
            for future in futures:  # in fixture order, as each finishes
                done = future.result()
                if done is None:
                    continue  # skipped after a fatal error
                if "fatal" in done:
                    print(f"{done['fatal']}\nStopping: this would fail the same way for every fixture.")
                    for later in (f for run in runs for f in run):
                        later.cancel()
                    return
                print("\n".join(done["lines"]), flush=True)
                results.append(done["record"])
                passed += bool(done["record"].get("pass"))
                usage = done["usage"]
                if usage:  # summed here, in the main thread
                    tokens["in"] += usage.input_tokens
                    tokens["out"] += usage.output_tokens
                    tokens["written"] += usage.cache_creation_input_tokens or 0
                    tokens["read"] += usage.cache_read_input_tokens or 0
            print(f"{passed}/{len(files)} passed. Tokens: {tokens['in']} uncached in, {tokens['written']} cache "
                  f"written, {tokens['read']} cache read, {tokens['out']} out ({MODEL}, effort {EFFORT}).", flush=True)
            name = f"{stamp}-run{number}.json" if args.runs > 1 else f"{stamp}.json"
            (out / name).write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"Done in {time.monotonic() - started:.0f} s ({args.runs} run(s), {args.workers} workers).")


if __name__ == "__main__":
    main(sys.argv[1:])
