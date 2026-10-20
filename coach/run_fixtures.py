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
# Shapes of real code, not prose: braces, operators, a statement ending in ';'.
# Names like std::invalid_argument or add("4") in a sentence are fine.
CODE_LIKE = re.compile(r"[{}]|==|!=|->|<<|#include|\)\s*;|\breturn\s+[^\s.,;]+\s*;")
SHOWN = ("note", "driver_action", "navigator_action", "next_test")
# A second instruction joined on: "... and make ...", "...; then run ...".
SECOND_TASK = re.compile(
    r";|\b(and|then)\s+(then\s+)?(make|write|add|run|fix|change|check|uncomment|comment|remove|rename|delete|"
    r"create|commit|build|keep|put|move|replace|extract|split|undo|revert|go|start|update|set)\b",
    re.IGNORECASE)
MAX_ACTION_WORDS = 20


def single_action(text):
    return len(text.split()) <= MAX_ACTION_WORDS and not SECOND_TASK.search(text)


def score(verdict, expect, phase):
    """Return a list of (field, ok, detail): the fixture's [expect] checks, plus
    two that apply to every fixture."""
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
        checks = score(verdict, expect, fx["phase"])
        ok = all(c[1] for c in checks)
        passed += ok

        print(f"{'PASS' if ok else 'FAIL'} {f.stem}  ({description})")
        for field, field_ok, got in checks:
            if field_ok and field in ("actions", "no_code", "single_action"):
                continue  # only worth a line when they fail
            mark = "  " if field_ok else "!!"
            print(f"   {mark} {field}: {got}   expected {expect.get(field, 'ok')}")
        if verdict["rule_problems"]:
            print(f"      problems: {'; '.join(verdict['rule_problems'])}")
        print(f"      note:      {verdict['note']}")
        print(f"      driver:    {verdict['driver_action']}")
        print(f"      navigator: {verdict['navigator_action']}")
        print(f"      next test: {verdict['next_test'] or '-'}\n")
        results.append({"fixture": f.stem, "pass": ok, "checks": checks, "verdict": verdict})

    print(f"{passed}/{len(files)} passed. Tokens: {input_tokens} uncached in, {cache_written} cache written, "
          f"{cache_read} cache read, {output_tokens} out ({MODEL}, effort {EFFORT}).")

    out = HERE / "results"
    out.mkdir(exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    (out / f"{stamp}.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1:])
