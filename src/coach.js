// The AI coach: when the pair clicks Done, Game sends the step (the pair's
// code before and after, from the helper) to the coach proxy on compucore3,
// which asks Claude whether they may move on and what to do next
// (coach/coach.py). Works for any C++/GoogleTest problem.
//
// Opt-in twice over: it needs a class code (from the start screen, or a
// ?class=CODE link from the teacher) and a connected helper, since the coach
// can only judge code it can see. Without both the game works as before.
//
// Game owns the flow (snapshots, history, holding, overrides); this module
// builds the request, talks to the proxy and keeps the praise streak.

const COACH_URL = "https://compucore3.setu.ie/rgg-coach";
const DEV_COACH_URL = "http://127.0.0.1:8100"; // coach/coach_server.py run locally
const CLASS_KEY = "RGG_CLASS_CODE";
const MASTERY_KEY = "RGG_COACH_MASTERY"; // per browser: good verdicts in a row, per phase
export const MASTERY_STREAK = 3; // after this many, stop praising plain good steps in that phase
const MAX_PROBLEM = 8000; // coach_server rejects longer problem text

// Bumped on every new game, so a reply that arrives afterwards is ignored.
let generation = 0;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function load(key, fallback) {
  try {
    return JSON.parse(storage()?.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked; the coach still works for this page
  }
}

function coachUrl(location = window.location) {
  return ["localhost", "127.0.0.1"].includes(location.hostname) ? DEV_COACH_URL : COACH_URL;
}

export function getClassCode() {
  return storage()?.getItem(CLASS_KEY) || "";
}

export function setClassCode(code) {
  const clean = (code || "").trim().toUpperCase();
  if (clean) storage()?.setItem(CLASS_KEY, clean);
  else storage()?.removeItem(CLASS_KEY);
}

// Call once on startup: a ?class=CODE link sets the class code.
export function startCoach(location = window.location) {
  const code = new URLSearchParams(location.search).get("class");
  if (code) setClassCode(code);
}

// New game: any reply still on its way belongs to the old game.
export function resetCoach() {
  generation++;
}

// What the pair is building, first non-empty wins: the start-screen text box,
// a ?problem= link from the teacher, the README in their solution folder
// (the helper sends it as {path, content}, or null when there isn't one).
export function resolveProblem(textBox, helperData, location = window.location) {
  const fromLink = new URLSearchParams(location?.search || "").get("problem");
  const candidates = [textBox, fromLink, helperData?.readme?.content];
  const problem = candidates.map((p) => (typeof p === "string" ? p.trim() : "")).find((p) => p) || "";
  return problem.slice(0, MAX_PROBLEM);
}

export function isCoached(helperState) {
  return !!getClassCode() && helperState?.status === "connected" && !!helperState.data;
}

const joinFiles = (files) => files.map((f) => `// ${f.path}\n${f.content}`).join("\n\n");
const filesOfKind = (snapshot, kind) => joinFiles((snapshot?.files || []).filter((f) => f.kind === kind));

// One line describing the latest build and test run, as the coach expects.
export function summariseResult(snapshot) {
  const build = snapshot?.build;
  if (build?.status === "failed" && (!snapshot.runTime || build.time >= snapshot.runTime)) {
    return "Build failed: " + (build.errors.slice(0, 3).join(" | ") || "unknown error");
  }
  const tests = snapshot?.tests || [];
  if (!tests.length) return "No test results yet";
  const failed = tests.filter((t) => t.status === "failed");
  const passed = tests.filter((t) => t.status === "passed").length;
  if (!failed.length) return `All ${passed} tests passed`;
  const details = failed.map((t) => (t.message ? `${t.name} (${t.message.split("\n")[0]})` : t.name));
  return `${failed.length} failed: ${details.join("; ")}; ${passed} passed`;
}

// The POST /coach body. `before` is the snapshot at the last accepted step,
// or null at the start of a game.
export function buildRequest({ phase, problem, before, after, ruleFindings = [], history = [] }) {
  const request = {
    phase,
    problem: problem || "",
    tests: filesOfKind(after, "test"),
    code: filesOfKind(after, "production"),
    test_result: summariseResult(after),
    rule_findings: ruleFindings.slice(0, 20).map((f) => String(f).slice(0, 500)),
    history: history.slice(-5).map((h) => ({
      phase: h.phase,
      decision: h.decision || "",
      note: (h.note || "").slice(0, 500),
    })),
  };
  if (before) {
    request.tests_before = filesOfKind(before, "test");
    request.code_before = filesOfKind(before, "production");
  }
  return request;
}

const ERROR_MESSAGES = {
  400: "The coach couldn't read this step (is the code very long?).",
  403: "The coach doesn't recognise your class code.",
  429: "Your class has used today's coaching allowance.",
  503: "The coach is busy. Carry on, it will look at your next step.",
};

// Ask the coach about one step. Never throws: resolves to
// { verdict, error, stale }, where verdict is null when error is set, and
// stale is true when a new game started while waiting (ignore the result).
export async function askCoach(step, fetchFn = fetch) {
  const gen = generation;
  let verdict = null;
  let error = "";
  try {
    const response = await fetchFn(coachUrl() + "/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Class-Code": getClassCode() },
      body: JSON.stringify(buildRequest(step)),
    });
    if (response.ok) verdict = await response.json();
    else error = ERROR_MESSAGES[response.status] || "The coach couldn't look at this step.";
  } catch {
    error = "Can't reach the coach right now.";
  }
  return { verdict, error, stale: gen !== generation };
}

// "hold": the pair stays on the step. "advice": they move on, with a
// suggestion worth reading. "good": they move on.
export function toneOf(verdict) {
  if (verdict.decision !== "advance") return "hold";
  return verdict.advice ? "advice" : "good";
}

// Records the verdict in the per-phase praise streak and says whether to show
// it. Only plain good verdicts are ever hidden, once a phase has had
// MASTERY_STREAK of them in a row. Call once per verdict received.
export function shouldShow(phase, verdict) {
  const mastery = load(MASTERY_KEY, {});
  const good = toneOf(verdict) === "good";
  const wasMastered = (mastery[phase] || 0) >= MASTERY_STREAK;
  mastery[phase] = good ? (mastery[phase] || 0) + 1 : 0;
  save(MASTERY_KEY, mastery);
  return !(good && wasMastered);
}
