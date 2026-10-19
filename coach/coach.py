"""The RedGreenGo coach: asks Claude to judge one TDD step against the game
rules and the kata pack. Shared by coach_server.py (the live proxy) and
run_fixtures.py (the offline eval), so both send exactly the same request.

A step is a dict:
    kata         kata pack id, e.g. "fizzbuzz" (src/content/katas/<kata>.js)
    phase        "red", "green" or "refactor"
    covered      behaviour ids covered before this step
    tests        the test file(s) now
    code         the production code now
    code_before  the production code before this step (omit if unchanged)
    test_result  one line: build failure or pass/fail counts
"""
import json
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).parent
KATA_DIR = HERE.parent / "src" / "content" / "katas"
MODEL = "claude-haiku-5-5"
EFFORT = "low"
PHASES = {"red", "green", "refactor"}
MAX_TEXT = 50_000  # characters per code/test field

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


class BadStep(ValueError):
    """The step is malformed; the message is safe to show the caller."""


def katas():
    return {p.stem for p in KATA_DIR.glob("*.js")}


@lru_cache
def build_system(kata):
    pack = (KATA_DIR / f"{kata}.js").read_text(encoding="utf-8")
    return (HERE / "prompt.md").read_text(encoding="utf-8").replace("{{KATA_PACK}}", pack)


def validate(step):
    if not isinstance(step, dict):
        raise BadStep("step must be an object")
    if step.get("kata") not in katas():
        raise BadStep("unknown kata")
    if step.get("phase") not in PHASES:
        raise BadStep("phase must be red, green or refactor")
    covered = step.get("covered", [])
    if not isinstance(covered, list) or not all(isinstance(c, str) and len(c) < 64 for c in covered):
        raise BadStep("covered must be a list of behaviour ids")
    for field in ("tests", "code", "test_result"):
        if not isinstance(step.get(field), str):
            raise BadStep(f"{field} is required")
    for field in ("tests", "code", "code_before", "test_result"):
        if len(step.get(field) or "") > MAX_TEXT:
            raise BadStep(f"{field} is too long")


def build_user(step):
    parts = [
        f"Step just finished: {step['phase'].upper()}",
        f"Behaviours already covered before this step: {', '.join(step.get('covered', [])) or 'none'}",
    ]
    if step.get("code_before"):
        parts.append(f"Production code before this step:\n```cpp\n{step['code_before'].strip()}\n```")
    else:
        parts.append("Production code was not changed during this step.")
    parts.append(f"Test file now:\n```cpp\n{step['tests'].strip()}\n```")
    parts.append(f"Production code now:\n```cpp\n{step['code'].strip()}\n```")
    parts.append(f"Build and test result at the end of this step: {step['test_result'].strip()}")
    return "\n\n".join(parts)


def ask_coach(client, step):
    """Return (verdict, usage). Raises anthropic.APIError, RuntimeError or json.JSONDecodeError."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        # The system prompt (rules + kata pack) is identical for every step of
        # a kata, so cache it; only the user message varies.
        system=[{"type": "text", "text": build_system(step["kata"]), "cache_control": {"type": "ephemeral"}}],
        output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": build_user(step)}],
    )
    if response.stop_reason != "end_turn":
        raise RuntimeError(f"stopped early: {response.stop_reason}")
    text = next(b.text for b in response.content if b.type == "text")
    verdict = json.loads(text)
    # Derived here rather than asked for, so it can't contradict the list.
    verdict["rules_ok"] = not verdict["rule_problems"]
    return verdict, response.usage
