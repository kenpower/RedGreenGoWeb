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
import { testNames, buildFailed } from "./rules.js";

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

export const STALE_FINDING = "Test results are out of date; run the tests again.";

// The snapshot with only results for tests still in the source, so a deleted,
// renamed or commented-out test's old result doesn't reach the coach. When no
// names can be read from the source (a macro we don't parse), all results stay.
export function currentSnapshot(snapshot) {
  if (!snapshot) return snapshot;
  const names = testNames(snapshot);
  if (!names.size) return snapshot;
  return { ...snapshot, tests: (snapshot.tests || []).filter((t) => names.has(t.name)) };
}

// The last test run doesn't describe the code now, so the coach shouldn't
// judge it: a source file changed after the run (when the helper sends file
// times), or, with a successful build, the run had tests that are no longer in
// the source or is missing tests that are. A failed build is fresh information
// in itself (its errors describe the code now), so it never counts as stale.
export function staleResults(snapshot) {
  if (!snapshot || buildFailed(snapshot)) return false;
  const runTime = snapshot.runTime || 0;
  const changed = (snapshot.files || []).some((f) => typeof f.mtime === "number" && f.mtime > runTime);
  if (changed && runTime) return true;
  const names = testNames(snapshot);
  if (!names.size) return false;
  const ran = new Set((snapshot.tests || []).map((t) => t.name));
  return [...ran].some((n) => !names.has(n)) || [...names].some((n) => !ran.has(n));
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
export function buildRequest({ phase, problem, before, after, ruleFindings = [], history = [], gameId = "", players = [] }) {
  // Stale results go first: until the pair runs the tests again, nothing
  // else the coach could say about the results can be trusted.
  const findings = staleResults(after) ? [STALE_FINDING, ...ruleFindings] : ruleFindings;
  const request = {
    phase,
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
