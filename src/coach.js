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
import { runMark, codeKey } from "./content/steps.js";

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

// A "Class code: XYZ" line in the pair's README.md gives the class code.
const README_CLASS = /^\s*class code\s*:\s*([A-Za-z0-9-]{2,40})\s*$/im;

export function classCodeFromReadme(content) {
  return (typeof content === "string" && content.match(README_CLASS)?.[1].toUpperCase()) || "";
}

// The README without its class-code line, for the coach's problem text.
const withoutClassLine = (text) => text.replace(new RegExp(README_CLASS.source, "gim"), "").trim();

// The class code from a link: ?class=CODE, from the helper (it opens the game
// with ?helper=1&class=… when started with --class-code) or a teacher's link.
export function linkedClassCode(location = window.location) {
  const params = new URLSearchParams(location?.search || "");
  const code = (params.get("class") || "").trim().toUpperCase();
  return code ? { code, source: params.has("helper") ? "helper" : "link" } : null;
}

// Is this a class the coach server knows? Resolves to {status: "ok", name},
// {status: "unknown"} (404), or {status: "unreachable"} (network error, a
// 429 or anything else: couldn't check, which is not the same as invalid).
export async function checkClassCode(code, fetchFn = fetch) {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) return { status: "unknown" };
  try {
    const response = await fetchFn(`${coachUrl()}/class?code=${encodeURIComponent(clean)}`);
    if (response.status === 404) return { status: "unknown" };
    if (!response.ok) return { status: "unreachable" };
    const body = await response.json();
    return body?.ok ? { status: "ok", name: body.name || clean } : { status: "unknown" };
  } catch {
    return { status: "unreachable" };
  }
}

// What the pair is building, first non-empty wins: the start-screen text box,
// a ?problem= link from the teacher, the README in their solution folder
// (the helper sends it as {path, content}, or null when there isn't one).
export function resolveProblem(textBox, helperData, location = window.location) {
  const fromLink = new URLSearchParams(location?.search || "").get("problem");
  const candidates = [textBox, fromLink, helperData?.readme?.content];
  const problem = candidates.map((p) => (typeof p === "string" ? withoutClassLine(p) : "")).find((p) => p) || "";
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
  cycle = 1, catalogue = null, novice = false, done = false, struggle = null, building = "", checkpoint = null,
}) {
  // Stale results go first: until the pair runs the tests again, nothing
  // else the coach could say about the results can be trusted.
  const findings = staleResults(after) ? [STALE_FINDING, ...ruleFindings] : ruleFindings;
  const last = history[history.length - 1];
  const request = {
    // one call for everything: the guidance (from the catalogue) and the verdict
    mode: "look",
    phase,
    cycle: Math.max(1, Math.floor(Number(cycle) || 1)), // the coach's leniency depends on it
    novice: !!novice,
    done: !!done, // a Done click: the server counts this Look's verdict
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
  if (catalogue?.length) request.catalogue = catalogue;
  if (struggle) request.struggle = struggleFields(struggle);
  // Refactor: the code at the last green run in this step, to review the change since
  if (phase === "refactor" && checkpoint)
    request.checkpoint = { tests: filesOfKind(checkpoint, "test"), code: filesOfKind(checkpoint, "production") };
  // what Orient said they're building (or the pair's words): read the same way every time
  if (String(building || "").trim()) request.building = String(building).trim().slice(0, 500);
  return request;
}

// The struggle signals (gameState.struggleSignals) as the server checks them:
// whole numbers from 0, the rung 1–3 the app chose for the step details.
const upTo = (n, max) => Math.min(max, Math.max(0, Math.floor(Number(n) || 0)));
const struggleFields = (s) => ({
  runs_without_progress: upTo(s.runs_without_progress, 1000),
  minutes_on_step: upTo(s.minutes_on_step, 100000),
  holds_on_step: upTo(s.holds_on_step, 1000),
  hints_shown: upTo(s.hints_shown, 4),
  novice: !!s.novice,
  rung: Math.max(1, upTo(s.rung, 3)),
});

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
  const { answer, error, stale } = await postCoach(buildRequest(step), fetchFn, "The coach couldn't look at this step.");
  return { verdict: answer, error, stale };
}

// Orient (DESIGN-coach-flow.md 3A): the coach reads the code once as the game
// starts (or as the helper connects) and says what the pair is building.
// Never throws: { brief, error, stale } like askCoach.
export async function askOrient(step, fetchFn = fetch) {
  const { answer, error, stale } = await postCoach(buildOrientRequest(step), fetchFn, "The coach couldn't read your code.");
  return { brief: answer, error, stale };
}

export function buildOrientRequest({ problem, after, ruleFindings = [], gameId = "", players = [], refactorings = null }) {
  return {
    mode: "orient",
    phase: refactorings ? "refactor" : "red",
    // the refactor lab: Orient also lists the smell board, each fixed by one of these
    ...(refactorings ? { lab: "refactor", refactorings: refactorings.slice(0, 20).map((r) => String(r).slice(0, 60)) } : {}),
    pair: pairKey(players),
    game_id: String(gameId || "").slice(0, 64),
    problem: problem || "",
    tests: filesOfKind(after, "test"),
    code: filesOfKind(after, "production"),
    test_result: summariseResult(currentSnapshot(after)),
    rule_findings: ruleFindings.slice(0, 20).map((f) => String(f).slice(0, 500)),
  };
}

// A refactor-lab Look (DESIGN-refactor-lab.md B.3): the change since the last
// commit, against the smell board. Never throws: { answer, error, stale }.
export async function askLab(step, fetchFn = fetch) {
  return postCoach(buildLabRequest(step), fetchFn, "The coach couldn't look at this change.");
}

export function buildLabRequest({
  problem, base, after, labPhase = "refactor", round = 1, refactorings = [], board = [], ruleFindings = [],
  gameId = "", players = [], rung = 1, rescue = false,
}) {
  const request = {
    mode: "look",
    lab: "refactor",
    phase: "refactor",
    lab_phase: labPhase,
    cycle: Math.max(1, Math.floor(Number(round) || 1)),
    refactorings: refactorings.slice(0, 20).map((r) => String(r).slice(0, 60)),
    board: board.slice(0, 8).map((s) => ({
      id: String(s.id).slice(0, 64), where: String(s.where).slice(0, 200), what: String(s.what).slice(0, 300),
      refactoring: String(s.refactoring).slice(0, 60), resolved: !!s.resolved,
    })),
    pair: pairKey(players),
    game_id: String(gameId || "").slice(0, 64),
    problem: problem || "",
    tests: filesOfKind(after, "test"),
    code: filesOfKind(after, "production"),
    test_result: summariseResult(currentSnapshot(after)),
    rule_findings: ruleFindings.slice(0, 20).map((f) => String(f).slice(0, 500)),
    struggle: struggleFields({ rung }),
  };
  if (base) {
    request.tests_before = filesOfKind(base, "test");
    request.code_before = filesOfKind(base, "production");
  }
  if (rescue) request.rescue = true;
  return request;
}

async function postCoach(body, fetchFn, failed) {
  const gen = generation;
  let answer = null;
  let error = "";
  try {
    const response = await fetchFn(coachUrl() + "/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Class-Code": getClassCode() },
      body: JSON.stringify(body),
    });
    if (response.ok) answer = await response.json();
    else error = ERROR_MESSAGES[response.status] || failed;
  } catch {
    error = "Can't reach the coach right now.";
  }
  return { answer, error, stale: gen !== generation };
}

// Whole numbers in the 0..10000 range coach_server accepts.
// A Done whose code and results haven't changed since the last Look: tell the
// coach server so it counts that Look's verdict as this Done (it looks the
// verdict up itself, so it can't be forged), without calling the model.
// Resolves true when recorded; false (409: nothing to reuse, or any error)
// means make a real Look with done: true instead. Never throws.
export async function reuseLook({ phase, gameId, players }, fetchFn = fetch) {
  try {
    const response = await fetchFn(coachUrl() + "/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Class-Code": getClassCode() },
      body: JSON.stringify({
        mode: "look", done: true, reuse: true, phase,
        game_id: String(gameId || "").slice(0, 64), pair: pairKey(players),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// What identifies the code and results a Look saw: the same key means Done can reuse it.
export const lookKey = (snapshot, stepNumber) => `${stepNumber}:${runMark(snapshot)}:${codeKey(snapshot)}`;

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
        refactorings: refactoringCounts(summary.refactorings),
        // the refactor lab (coach_server: mode tdd | refactor; the round counts only for a lab)
        mode: summary.mode === "refactor" ? "refactor" : "tdd",
        ...(summary.mode === "refactor"
          ? { rounds: count(summary.rounds), commits: count(summary.commits), reverts: count(summary.reverts) }
          : {}),
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

// The refactorings the coach saw, as coach_server takes them: at most 20 names
// of at most 60 characters, whole counts.
function refactoringCounts(counts) {
  const entries = Object.entries(counts && typeof counts === "object" ? counts : {})
    .map(([name, n]) => [String(name).trim().slice(0, 60), count(n)])
    .filter(([name]) => name);
  return Object.fromEntries(entries.slice(0, 20));
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
