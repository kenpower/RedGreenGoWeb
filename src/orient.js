// Words for the Orient card (OrientCard.svelte): what the coach read from the
// pair's code at the start of a game. The brief comes from the coach's
// "orient" mode: {building, code_state, warnings, first_move}.

export const CODE_STATE_TEXT = {
  empty: "Nothing yet: no tests and no code. Start with the simplest case.",
  scaffold: "A starting point: a placeholder test, headers or stubs, but nothing tested yet.",
  partial: "Some behaviours are tested and working. The first move is the next example it gets wrong.",
  looks_done: "Your tests seem to cover the problem. Finish, or test an edge case they miss.",
};

// The pair's own words replace the coach's `building`; they are also sent to the
// teacher as an "orient" event, whose detail is at most 500 characters.
export const MAX_PROBLEM_EDIT = 500;

export function codeStateText(brief) {
  return CODE_STATE_TEXT[brief?.code_state] || "";
}

// Only non-empty strings; the coach may send "" for "nothing to warn about".
export function warningsOf(brief) {
  return (Array.isArray(brief?.warnings) ? brief.warnings : [])
    .filter((w) => typeof w === "string")
    .map((w) => w.trim())
    .filter(Boolean);
}

// After "Read my code again" finishes: say what happened, so a re-read that
// comes back with the same reading doesn't look like a button that did nothing.
export function rereadNote(before, after, error) {
  if (error) return "";
  if (!after) return "";
  const same = (a, b) => (a?.building || "") === (b?.building || "") && a?.code_state === b?.code_state
    && (a?.first_move || "") === (b?.first_move || "")
    && warningsOf(a).join("\n") === warningsOf(b).join("\n");
  return before && same(before, after)
    ? "Read your code again: the coach sees the same as before."
    : "Read your code again: updated below.";
}

// What "Save" sends: trimmed and cut to fit. "" means nothing to save.
export function problemEdit(text) {
  return String(text ?? "").trim().slice(0, MAX_PROBLEM_EDIT);
}
