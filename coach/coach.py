"""The RedGreenGo coach: asks Claude to judge one TDD step on any C++ problem,
decide whether the pair may move on, and say what the driver and navigator
should do next. Shared by coach_server.py (the live proxy) and run_fixtures.py
(the offline eval), so both send exactly the same request.

A step is a dict:
    phase          "red", "green", "refactor" or "finish"
    problem        what the pair is building, or "" (the coach infers it)
    tests          the test file(s) now
    code           the production code now
    tests_before   the tests at the last step the coach accepted (optional)
    code_before    the production code then (optional)
    test_result    one line: build failure or pass/fail counts
    rule_findings  broken rules found by the app's own checks (optional)
    history        the last few verdicts: [{phase, decision, note}] (optional)
"""
import json
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).parent
MODEL = "claude-haiku-5-5"
EFFORT = "low"
PHASES = {"red", "green", "refactor", "finish"}
DECISIONS = {"advance", "redo", "back_to_red"}
MAX_TEXT = 10_000  # characters per code/test field (~3k tokens); a FizzBuzz file is a few hundred
MAX_PROBLEM = 8_000  # the helper sends at most ~8 KB of README
MAX_FINDINGS = 20
MAX_HISTORY = 5
MAX_NOTE = 500

SCHEMA = {
    "type": "object",
    "properties": {
        "decision": {"type": "string", "enum": sorted(DECISIONS)},
        "rule_problems": {"type": "array", "items": {"type": "string"}},
        "note": {"type": "string"},
        "driver_action": {"type": "string"},
        "navigator_action": {"type": "string"},
        "next_test": {"type": "string"},
        "likely_finished": {"type": "boolean"},
        "advice": {"type": "boolean"},
    },
    "required": ["decision", "rule_problems", "note", "driver_action", "navigator_action",
                 "next_test", "likely_finished", "advice"],
    "additionalProperties": False,
}


class BadStep(ValueError):
    """The step is malformed; the message is safe to show the caller."""


@lru_cache
def build_system():
    return (HERE / "prompt.md").read_text(encoding="utf-8")


def _short_strings(value, count, length):
    return isinstance(value, list) and len(value) <= count and all(
        isinstance(v, str) and len(v) <= length for v in value)


def validate(step):
    if not isinstance(step, dict):
        raise BadStep("step must be an object")
    if step.get("phase") not in PHASES:
        raise BadStep("phase must be red, green, refactor or finish")
    if not isinstance(step.get("problem", ""), str) or len(step.get("problem", "")) > MAX_PROBLEM:
        raise BadStep("problem must be text of at most 8000 characters")
    for field in ("tests", "code", "test_result"):
        if not isinstance(step.get(field), str):
            raise BadStep(f"{field} is required")
    for field in ("tests_before", "code_before"):
        if step.get(field) is not None and not isinstance(step[field], str):
            raise BadStep(f"{field} must be text")
    for field in ("tests", "code", "tests_before", "code_before", "test_result"):
        if len(step.get(field) or "") > MAX_TEXT:
            raise BadStep(f"{field} is too long")
    # Who and which game, for the teacher's progress view (coach_server records them).
    for field, limit in (("pair", 200), ("game_id", 64)):
        if not isinstance(step.get(field, ""), str) or len(step.get(field, "")) > limit:
            raise BadStep(f"{field} must be text of at most {limit} characters")
    if not _short_strings(step.get("rule_findings", []), MAX_FINDINGS, MAX_NOTE):
        raise BadStep("rule_findings must be a short list of short strings")
    history = step.get("history", [])
    if not isinstance(history, list) or len(history) > MAX_HISTORY:
        raise BadStep("history must be a list of at most 5 entries")
    for h in history:
        if (not isinstance(h, dict) or h.get("phase") not in PHASES
                or h.get("decision", "") not in DECISIONS | {""}
                or not isinstance(h.get("note", ""), str) or len(h.get("note", "")) > MAX_NOTE):
            raise BadStep("history entries need a phase, a decision and a short note")


def _block(title, text):
    return f"{title}:\n```cpp\n{text.strip()}\n```" if text.strip() else f"{title}: (none)"


def build_user(step):
    phase = step["phase"]
    parts = [
        f"Problem:\n{step.get('problem', '').strip() or '(not given)'}",
        f"Step just finished: {phase.upper()}" if phase != "finish"
        else "The pair says they are FINISHED with the problem.",
    ]
    history = step.get("history", [])
    if history:
        lines = [f"- {h['phase']}: {h.get('decision') or 'no verdict'}. {h.get('note', '')}".rstrip()
                 for h in history]
        parts.append("Your earlier verdicts, oldest first:\n" + "\n".join(lines))
    findings = step.get("rule_findings", [])
    parts.append("Rule findings from the game's checks:\n" + (
        "\n".join(f"- {f}" for f in findings) if findings else "(none)"))

    for name, now_key, before_key in (("Tests", "tests", "tests_before"), ("Production code", "code", "code_before")):
        before = step.get(before_key)
        if before is None:
            parts.append(_block(f"{name} now", step[now_key]))
        elif before == step[now_key]:
            parts.append(_block(f"{name} (unchanged during this step)", step[now_key]))
        else:
            parts.append(_block(f"{name} before this step", before))
            parts.append(_block(f"{name} now", step[now_key]))
    parts.append(f"Build and test result now: {step['test_result'].strip()}")
    return "\n\n".join(parts)


def ask_coach(client, step):
    """Return (verdict, usage). Raises anthropic.APIError, RuntimeError or json.JSONDecodeError."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        # The system prompt is the same for every request, so cache it; the
        # problem and the pair's code go in the user message.
        system=[{"type": "text", "text": build_system(), "cache_control": {"type": "ephemeral"}}],
        output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": build_user(step)}],
    )
    if response.stop_reason != "end_turn":
        raise RuntimeError(f"stopped early: {response.stop_reason}")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text), response.usage
