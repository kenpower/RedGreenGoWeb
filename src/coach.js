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
import { currentSnapshot, staleResults } from "./rules.js";

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

// The local dev coach only on the dev server (npm run dev, port 8080). The
// game page the helper serves (127.0.0.1:8000) is a real game: real coach.
export function coachUrl(location = window.location) {
  const local = ["localhost", "127.0.0.1"].includes(location?.hostname);
  return local && String(location.port) === "8080" ? DEV_COACH_URL : COACH_URL;
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

export const STALE_FINDING = "Test results are out of date; run the tests again.";
// They live with the other rule checks; re-exported for existing callers.
export { currentSnapshot, staleResults };

// What the game requires of this step, as one sentence the coach treats as
// fact. `live` is rules.liveStatus for the step (or null): its focus test
// names the test, and by the time the coach is asked the game has already
// checked the counts.
export function expectedFor(phase, live, { novice = false } = {}) {
  const required = requiredFor(phase, live);
  // the first cycles: the coach adds the why, briefly
  return required && novice ? required + " " + NOVICE : required;
}

const NOVICE = "The pair is new to TDD: give the reason in one short clause.";

function requiredFor(phase, live) {
  const test = live?.focusTest;
  switch (phase) {
    case "red":
      return test
        ? `Red: one new test, ${test}, that fails for the right reason. The game has checked it is the only new test and that it fails.`
        : "Red: one new test that fails for the right reason.";
    case "green":
      return test
        ? `Green: make ${test} pass with the least production code, test files unchanged. The game has checked all tests pass.`
        : "Green: make the failing test pass with the least production code, test files unchanged.";
    case "refactor":
      return "Refactor: tidy the production code without changing what it does, same tests, all passing. The game has checked the tests.";
    case "finish":
      return "Finish: the tests cover everything the problem asks for, and all pass.";
    default:
      return "";
  }
}

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

// Identifies a pair on the coach server, for the teacher's grading view:
// names as entered, trimmed and lowercased, blanks dropped, e.g. "jane__john".
export function pairKey(players) {
  return (players || [])
    .map((p) => (typeof p === "string" ? p.trim().toLowerCase() : ""))
    .filter((p) => p)
    .join("__")
    .slice(0, 200);
}

// The POST /coach body. `before` is the snapshot at the last accepted step,
// or null at the start of a game.
export function buildRequest({
  phase, problem, before, after, ruleFindings = [], history = [], gameId = "", players = [], expected = "", rescue = false,
}) {
  // Stale results go first: until the pair runs the tests again, nothing
  // else the coach could say about the results can be trusted.
  const findings = staleResults(after) ? [STALE_FINDING, ...ruleFindings] : ruleFindings;
  const last = history[history.length - 1];
  const request = {
    phase,
    expected: String(expected || "").slice(0, 300),
    previous: last
      ? { phase: last.phase, decision: last.decision || "", note: (last.note || "").slice(0, 500) }
      : null,
    pair: pairKey(players),
    game_id: String(gameId || "").slice(0, 64),
    problem: problem || "",
    tests: filesOfKind(after, "test"),
    code: filesOfKind(after, "production"),
    test_result: summariseResult(currentSnapshot(after)),
    rule_findings: findings.slice(0, 20).map((f) => String(f).slice(0, 500)),
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
  // stuck on this step: the one request where the coach may show code
  if (rescue) request.rescue = true;
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

// Whole numbers in the 0..10000 range coach_server accepts.
// The coach's pick of what to do next on this step, from the step catalogue
// (src/content/steps.js): {steps: [{id, detail}], extra, extra_needed}, or
// null if it couldn't answer. Never holds, never decides; never throws.
export async function askNextSteps(step, catalogue, { novice = false } = {}, fetchFn = fetch) {
  try {
    const request = { ...buildRequest(step), mode: "next_steps", catalogue, novice };
    delete request.history; // not used for next steps
    const response = await fetchFn(coachUrl() + "/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Class-Code": getClassCode() },
      body: JSON.stringify(request),
    });
    if (!response.ok) return null;
    const answer = await response.json();
    return Array.isArray(answer?.steps) ? answer : null;
  } catch {
    return null;
  }
}

const count = (n) => (Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 10000) : 0);

// Records the pair's progress on the coach server for the teacher's grading
// view. Fire and forget: resolves to whether it was sent, never throws, and
// does nothing without a class code. No helper needed.
export async function sendProgress(summary, fetchFn = fetch) {
  const code = getClassCode();
  if (!code || !summary?.game_id) return false;
  try {
    const response = await fetchFn(coachUrl() + "/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Class-Code": code },
      // keepalive: still delivered if the pair closes the tab right after
      keepalive: true,
      body: JSON.stringify({
        game_id: String(summary.game_id).slice(0, 64),
        pair: pairKey(summary.pair),
        problem: (summary.problem || "").trim().slice(0, 100),
        steps: count(summary.steps),
        cycles: count(summary.cycles),
        phase: summary.phase || "",
        overrides: count(summary.overrides),
        back_to_red: count(summary.back_to_red),
        finished: !!summary.finished,
        rescues: count(summary.rescues),
        passed_first: count(summary.passed_first),
        events: (summary.events || []).slice(0, 10).map((e) => ({
          t: Math.floor(Number(e.t) || 0),
          kind: String(e.kind || ""),
          phase: String(e.phase || ""),
          cycle: Math.max(1, count(e.cycle)),
          detail: String(e.detail || "").slice(0, 500),
        })),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
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
