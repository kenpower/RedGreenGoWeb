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
import sys
import tomllib
from pathlib import Path

import anthropic

HERE = Path(__file__).parent
ROOT = HERE.parent
MODEL = "claude-haiku-5-5"
EFFORT = "low"

SCHEMA = {
    "type": "object",
    "properties": {
        "targeted": {"type": "string"},
        "rule_problems": {"type": "array", "items": {"type": "string"}},
        "ordering": {"type": "string", "enum": ["good", "fine", "questionable", "bad", "n_a"]},
        "note": {"type": "string"},
        "teacher_next": {"type": "string"},
    },
    "required": ["targeted", "rule_problems", "ordering", "note", "teacher_next"],
    "additionalProperties": False,
}


def build_system(kata):
    pack = (ROOT / "src" / "content" / "katas" / f"{kata}.js").read_text(encoding="utf-8")
    return (HERE / "prompt.md").read_text(encoding="utf-8").replace("{{KATA_PACK}}", pack)


def build_user(fx):
    parts = [
        f"Step just finished: {fx['phase'].upper()}",
        f"Behaviours already covered before this step: {', '.join(fx['covered']) or 'none'}",
    ]
    if "code_before" in fx:
        parts.append(f"Production code before this step:\n```cpp\n{fx['code_before'].strip()}\n```")
    else:
        parts.append("Production code was not changed during this step.")
    parts.append(f"Test file now:\n```cpp\n{fx['tests'].strip()}\n```")
    parts.append(f"Production code now:\n```cpp\n{fx['code'].strip()}\n```")
    parts.append(f"Build and test result at the end of this step: {fx['test_result'].strip()}")
    return "\n\n".join(parts)


def ask_coach(client, fx):
    response = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        # The system prompt (rules + kata pack) is identical for every step of
        # a kata, so cache it; only the user message varies.
        system=[{"type": "text", "text": build_system(fx["kata"]), "cache_control": {"type": "ephemeral"}}],
        output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": build_user(fx)}],
    )
    if response.stop_reason != "end_turn":
        raise RuntimeError(f"stopped early: {response.stop_reason}")
    text = next(b.text for b in response.content if b.type == "text")
    verdict = json.loads(text)
    # Derived here rather than asked for, so it can't contradict the list.
    verdict["rules_ok"] = not verdict["rule_problems"]
    return verdict, response.usage


def score(verdict, expect):
    """Return a list of (field, ok, detail) for each field the fixture checks."""
    checks = []
    if "targeted" in expect:
        checks.append(("targeted", verdict["targeted"] in expect["targeted"], verdict["targeted"]))
    if "ordering" in expect:
        checks.append(("ordering", verdict["ordering"] in expect["ordering"], verdict["ordering"]))
    if "rules_ok" in expect:
        checks.append(("rules_ok", verdict["rules_ok"] == expect["rules_ok"], verdict["rules_ok"]))
    if "max_problems" in expect:
        count = len(verdict["rule_problems"])
        checks.append(("max_problems", count <= expect["max_problems"], count))
    return checks


def main(prefixes):
    files = sorted((HERE / "fixtures").glob("*.toml"))
    if prefixes:
        files = [f for f in files if any(f.stem.startswith(p) for p in prefixes)]

    client = anthropic.Anthropic()
    results, passed, input_tokens, output_tokens, cache_written, cache_read = [], 0, 0, 0, 0, 0

    for f in files:
        fx = tomllib.loads(f.read_text(encoding="utf-8"))
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
        checks = score(verdict, fx["expect"])
        ok = all(c[1] for c in checks)
        passed += ok

        print(f"{'PASS' if ok else 'FAIL'} {f.stem}  ({fx['description']})")
        for field, field_ok, got in checks:
            mark = "  " if field_ok else "!!"
            print(f"   {mark} {field}: {got}   expected {fx['expect'][field]}")
        if verdict["rule_problems"]:
            print(f"      problems: {'; '.join(verdict['rule_problems'])}")
        print(f"      note: {verdict['note']}")
        print(f"      next: {verdict['teacher_next']}\n")
        results.append({"fixture": f.stem, "pass": ok, "verdict": verdict})

    print(f"{passed}/{len(files)} passed. Tokens: {input_tokens} uncached in, {cache_written} cache written, "
          f"{cache_read} cache read, {output_tokens} out ({MODEL}, effort {EFFORT}).")

    out = HERE / "results"
    out.mkdir(exist_ok=True)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    (out / f"{stamp}.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1:])
