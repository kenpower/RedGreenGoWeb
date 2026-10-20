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
    intent         Red only: what the navigator said the new test checks (optional)
    expected       what the game requires of this step, already checked by it (optional)
    previous       the verdict on the step before: {phase, decision, note} or None (optional)
    pair, game_id  who and which game, for coach_server's records (optional)
    cycle          which Red-Green-Refactor cycle, from 1 (optional; leniency depends on it)
    rescue         true when the pair is stuck and asked to see the code (optional)
    mode           "look" (the default; "verdict"/"next_steps" are older names for it)
    catalogue      [{id, text}] for this phase: the steps the guidance picks from (optional)
    novice         true in the first cycles: a detail on every step (optional)
    done           true when the pair clicked Done (coach_server counts these) (optional)

Every answer is a Look: the guidance (steps, extra, extra_needed, on_track) and
the verdict (decision, note, actions, hints, …) for the step as it is now.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).parent
MODEL = "claude-haiku-5-5"
EFFORT = "medium"  # low missed noticeably more eval checks (2026-10-20); medium costs ~1.7x output
PHASES = {"red", "green", "refactor", "finish"}
DECISIONS = {"advance", "redo", "back_to_red"}
MAX_TEXT = 10_000  # characters per code/test field (~3k tokens); a FizzBuzz file is a few hundred
MAX_PROBLEM = 8_000  # the helper sends at most ~8 KB of README
MAX_FINDINGS = 20
MAX_HISTORY = 5
MAX_NOTE = 500
MAX_INTENT = 200
MAX_EXPECTED = 300

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
        "intent_match": {"type": "string", "enum": ["yes", "partly", "no", "n_a"]},
        "hint_question": {"type": "string"},
        "hint_kind": {"type": "string"},
        "smell_question": {"type": "string"},
        "smell_detail": {"type": "string"},
        # Only when the request has rescue: true; "" otherwise.
        "rescue_code": {"type": "string"},
        "rescue_why": {"type": "string"},
    },
    "required": ["decision", "rule_problems", "note", "driver_action", "navigator_action",
                 "next_test", "likely_finished", "advice", "intent_match",
                 "hint_question", "hint_kind", "smell_question", "smell_detail",
                 "rescue_code", "rescue_why"],
    "additionalProperties": False,
}

# Every request is a "look": one request, one answer with the verdict and the
# guidance, served by two model calls (asked together, Haiku let the catalogue
# sway the verdict). "verdict" and "next_steps" are the older names, still
# accepted from cached clients; they get the same answer.
MODES = {"look", "verdict", "next_steps"}
MAX_CATALOGUE = 60
MAX_NEXT_STEPS = 4
# Code in a guidance detail: braces, operators, a call with brackets, a GoogleTest
# macro. Such a detail is blanked (the step's own text still stands); run_fixtures
# checks with the same pattern.
DETAIL_CODE_LIKE = re.compile(r"[{}]|==|!=|->|<<|\)\s*;|\b[A-Za-z_]\w*\([^)]*\)|\b(?:EXPECT|ASSERT)_[A-Z]+\b")


def guidance_schema(catalogue):
    """The guidance (coach/next_steps.md): never empty, and its ids come from this
    phase's catalogue only (left free, it picks the next phase's steps after an
    advance). The catalogue is fixed per phase, so there are few schemas."""
    step = {
        "type": "object",
        "properties": {"id": {"type": "string", "enum": [c["id"] for c in catalogue]},
                       "detail": {"type": "string"}},
        "required": ["id", "detail"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "steps": {"type": "array", "minItems": 1, "items": step},
            "extra": {"type": "string"},
            "extra_needed": {"type": "boolean"},
            "on_track": {"type": "boolean"},
        },
        "required": ["steps", "extra", "extra_needed", "on_track"],
        "additionalProperties": False,
    }


class BadStep(ValueError):
    """The step is malformed; the message is safe to show the caller."""


@lru_cache
def build_system(name="prompt.md"):
    return (HERE / name).read_text(encoding="utf-8")


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
    # Who and which game, for the teacher's progress view (coach_server records
    # them), and the navigator's one-line intent for a Red.
    for field, limit in (("pair", 200), ("game_id", 64), ("intent", MAX_INTENT)):
        if not isinstance(step.get(field, ""), str) or len(step.get(field, "")) > limit:
            raise BadStep(f"{field} must be text of at most {limit} characters")
    cycle = step.get("cycle", 1)
    if not isinstance(cycle, int) or isinstance(cycle, bool) or not 1 <= cycle <= 10000:
        raise BadStep("cycle must be a whole number from 1")
    if not _short_strings(step.get("rule_findings", []), MAX_FINDINGS, MAX_NOTE):
        raise BadStep("rule_findings must be a short list of short strings")
    history = step.get("history", [])
    if not isinstance(history, list) or len(history) > MAX_HISTORY:
        raise BadStep("history must be a list of at most 5 entries")
    if not all(_verdict_entry(h) for h in history):
        raise BadStep("history entries need a phase, a decision and a short note")
    if not isinstance(step.get("expected", ""), str) or len(step.get("expected", "")) > MAX_EXPECTED:
        raise BadStep(f"expected must be text of at most {MAX_EXPECTED} characters")
    if step.get("previous") is not None and not _verdict_entry(step["previous"]):
        raise BadStep("previous needs a phase, a decision and a short note")
    if not isinstance(step.get("rescue", False), bool):
        raise BadStep("rescue must be true or false")
    if step.get("rescue") and step["phase"] == "finish":
        raise BadStep("rescue is for a Red, Green or Refactor step")
    if step.get("mode", "look") not in MODES:
        raise BadStep("mode must be look")
    catalogue = step.get("catalogue")
    if catalogue is not None and (
            not isinstance(catalogue, list) or not 0 < len(catalogue) <= MAX_CATALOGUE
            or not all(isinstance(c, dict) and isinstance(c.get("id"), str) and len(c["id"]) <= 64
                       and isinstance(c.get("text"), str) and len(c["text"]) <= 300 for c in catalogue)):
        raise BadStep("catalogue must be a list of [{id, text}]")
    for flag in ("novice", "done"):
        if not isinstance(step.get(flag, False), bool):
            raise BadStep(f"{flag} must be true or false")
    struggle = step.get("struggle")
    if struggle is not None and not _struggle_ok(struggle):
        raise BadStep("struggle must be {runs_without_progress, minutes_on_step, holds_on_step, "
                      "hints_shown, novice, rung} with whole numbers and a rung from 1 to 3")


def _whole(n, top):
    return isinstance(n, int) and not isinstance(n, bool) and 0 <= n <= top


def _struggle_ok(s):
    """The app's struggle signals (DESIGN-coach-flow.md section 6); every field optional."""
    known = {"runs_without_progress", "minutes_on_step", "holds_on_step", "hints_shown", "novice", "rung"}
    return (isinstance(s, dict) and set(s) <= known
            and all(_whole(s.get(k, 0), top) for k, top in (
                ("runs_without_progress", 1000), ("minutes_on_step", 100_000), ("holds_on_step", 1000),
                ("hints_shown", 4)))
            and isinstance(s.get("novice", False), bool)
            and _whole(s.get("rung", 1), 3) and s.get("rung", 1) >= 1)


def _verdict_entry(h):
    return (isinstance(h, dict) and h.get("phase") in PHASES
            and h.get("decision", "") in DECISIONS | {""}
            and isinstance(h.get("note", ""), str) and len(h.get("note", "")) <= MAX_NOTE)


def _block(title, text):
    return f"{title}:\n```cpp\n{text.strip()}\n```" if text.strip() else f"{title}: (none)"


def build_user(step):
    phase = step["phase"]
    parts = [
        f"Problem:\n{step.get('problem', '').strip() or '(not given)'}",
        f"Cycle {step.get('cycle', 1)}.",
        (f"Step just finished: {phase.upper()}" if step.get("done")
         else f"Step in progress: {phase.upper()} (a fresh test run or build just arrived; "
              "judge it as if they had just finished the step)")
        if phase != "finish" else "The pair says they are FINISHED with the problem.",
    ]
    if step.get("rescue"):
        parts.append("RESCUE: the pair has been held on this step three times and asked to be shown the code. "
                     "Fill rescue_code and rescue_why for this step only.")
    if step.get("expected", "").strip():
        parts.append(f"What the game requires of this step (already checked by the game, treat as true):\n"
                     f"{step['expected'].strip()}")
    previous = step.get("previous")
    if previous:
        parts.append(f"Your verdict on their previous step ({previous['phase']}): "
                     f"{previous.get('decision') or 'no verdict'}. {previous.get('note', '')}".rstrip())
    if phase == "red":
        intent = step.get("intent", "").strip()
        parts.append(f"The navigator said the new test checks: {intent}" if intent
                     else "The navigator didn't say what the new test checks.")
    history = step.get("history", [])
    if history:
        lines = [f"- {h['phase']}: {h.get('decision') or 'no verdict'}. {h.get('note', '')}".rstrip()
                 for h in history]
        parts.append("Your earlier verdicts, oldest first:\n" + "\n".join(lines))
    findings = step.get("rule_findings", [])
    parts.append("Rule findings from the game's checks:\n" + (
        "\n".join(f"- {f}" for f in findings) if findings else "(none)"))

    parts.extend(_code_blocks(step))
    return "\n\n".join(parts)


def _code_blocks(step):
    parts = []
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
    return parts


# How specific the guidance details are, by the hint rung the app chose (struggle.rung).
RUNG_DETAILS = {
    1: "Point at where to look (the file, function or test), but give no values, expected results "
       "or names of code they haven't written.",
    2: "Name the kind of change and where, still with no values or expected results.",
    3: "Be specific: name the test or function to change and the literal values.",
}


def build_guidance_user(step, verdict):
    """The guidance call: the step plus the settled verdict, so the two agree."""
    parts = [
        f"Problem:\n{step.get('problem', '').strip() or '(not given)'}",
        f"Phase: {step['phase'].upper()}. Cycle {step.get('cycle', 1)}.",
    ]
    if step.get("novice"):
        parts.append("The pair is new to TDD: give a detail for every step.")
    struggle = step.get("struggle") or {}
    rung = 3 if step.get("novice") or struggle.get("novice") else struggle.get("rung", 3)
    parts.append(f"Hint rung for the details: {rung}. " + RUNG_DETAILS[rung]
                 + (f" They have run the tests {struggle['runs_without_progress']} times on this step "
                    "without getting closer." if struggle.get("runs_without_progress") else ""))
    if step.get("expected", "").strip():
        parts.append(f"What the game requires of this step: {step['expected'].strip()}")
    findings = step.get("rule_findings", [])
    parts.append("Rule findings from the game's checks:\n" + (
        "\n".join(f"- {f}" for f in findings) if findings else "(none)"))
    parts.extend(_code_blocks(step))
    held = {"advance": "advances: the step is complete",
            "redo": "holds the step (redo)", "back_to_red": "holds the step (back to Red)"}
    parts.append(f"The coach's verdict on the step as it is now: it {held[verdict['decision']]}. "
                 f"Its note: {verdict.get('note', '').strip()}")
    parts.append("Catalogue for this phase:\n" + "\n".join(f"[{c['id']}] {c['text']}" for c in step["catalogue"]))
    return "\n\n".join(parts)


def _clean_steps(answer, step):
    """Keep only catalogue ids, each once, at most MAX_NEXT_STEPS, in the coach's order,
    and blank any detail (or extra) that has code in it."""
    def no_code(text):
        text = (text or "").strip()
        return "" if DETAIL_CODE_LIKE.search(text) else text

    known = {c["id"] for c in step["catalogue"]}
    seen, steps = set(), []
    for s in answer.get("steps", []):
        if s.get("id") in known and s["id"] not in seen:
            seen.add(s["id"])
            steps.append({"id": s["id"], "detail": no_code(s.get("detail"))})
    return {"steps": steps[:MAX_NEXT_STEPS], "extra": no_code(answer.get("extra")),
            "extra_needed": bool(answer.get("extra_needed")), "on_track": bool(answer.get("on_track", True))}


NO_GUIDANCE = {"steps": [], "extra": "", "extra_needed": False, "on_track": True}


class Usage:
    """The token counts of both calls, added up (same fields as the API's usage)."""
    FIELDS = ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")

    def __init__(self, *usages):
        for field in self.FIELDS:
            setattr(self, field, sum(getattr(u, field, 0) or 0 for u in usages))


def _ask(client, system, schema, user, max_tokens):
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        # Each system prompt is the same for every request, so cache it; the
        # problem and the pair's code go in the user message.
        system=[{"type": "text", "text": build_system(system), "cache_control": {"type": "ephemeral"}}],
        output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": user}],
    )
    if response.stop_reason != "end_turn":
        raise RuntimeError(f"stopped early: {response.stop_reason}")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text), response.usage


def ask_coach(client, step, guidance=None):
    """Return (answer, usage): one Look, the verdict fields and the guidance (steps,
    extra, extra_needed, on_track) together. The verdict comes first (coach/prompt.md),
    then, with a catalogue, the guidance is asked with that verdict
    (coach/next_steps.md); usage adds up both. A Look for a Done (done: true) is
    the verdict alone: after an advance nobody sees this step's guidance, and a
    held step's card falls back to the app's rule-picked steps until the next
    Look. `guidance` True asks for it anyway (run_fixtures scores it on every
    fixture). Raises anthropic.APIError, RuntimeError or json.JSONDecodeError."""
    if guidance is None:
        guidance = not step.get("done")
    verdict, usage = _ask(client, "prompt.md", SCHEMA, build_user(step), 4000)
    if not step.get("catalogue") or not guidance:
        return {**verdict, **NO_GUIDANCE}, usage
    picked, more = _ask(client, "next_steps.md", guidance_schema(step["catalogue"]),
                        build_guidance_user(step, verdict), 3000)
    return {**verdict, **_clean_steps(picked, step)}, Usage(usage, more)
