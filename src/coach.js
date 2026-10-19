// The AI coach: after each Red, Green or Refactor step, sends the pair's code
// (from the helper) to the coach proxy on compucore3, which asks Claude to
// judge the step against the game rules and the kata pack (coach/coach.py).
//
// Opt-in twice over: it needs a class code (from the start screen, or a
// ?class=CODE link from the teacher) and a connected helper, since the coach
// can only judge code it can see. Without both the game works as before.
import { writable } from "svelte/store";
import { fizzbuzz } from "./content/katas/fizzbuzz.js";

export const KATA = fizzbuzz;
const COACH_URL = "https://compucore3.setu.ie/rgg-coach";
const DEV_COACH_URL = "http://127.0.0.1:8100"; // coach/coach_server.py run locally
const CLASS_KEY = "RGG_CLASS_CODE";
const PROGRESS_KEY = "RGG_COACH_PROGRESS"; // per game: covered behaviours, code at last Done
const MASTERY_KEY = "RGG_COACH_MASTERY"; // per browser: good steps in a row, per phase
export const MASTERY_STREAK = 3; // after this many good steps in a row, only speak up about problems
const COACHED_PHASES = ["red", "green", "refactor"];

// status: "idle" | "asking" | "done" | "error"
export const coach = writable({ status: "idle", phase: null, verdict: null, show: false, message: "" });
// Behaviours covered this game; only set when that list changes.
export const covered = writable(load(PROGRESS_KEY, emptyProgress()).covered);

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

function emptyProgress() {
  return { covered: [], codeAtLastDone: null };
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

// New game: forget what was covered and the last code seen (mastery is kept).
export function resetCoach() {
  covered.set([]);
  save(PROGRESS_KEY, emptyProgress());
  coach.set({ status: "idle", phase: null, verdict: null, show: false, message: "" });
}

// The next behaviour on the teacher's route, given what has been covered in
// any order. Behaviours the route visits twice need covering twice; an
// optional behaviour is skipped once anything after it on the route is covered.
export function nextBehaviour(pack, covered) {
  const remaining = {};
  for (const id of covered) remaining[id] = (remaining[id] || 0) + 1;
  const route = pack.teacherRoute.flat();
  const byId = Object.fromEntries(pack.behaviours.map((b) => [b.id, b]));

  for (let i = 0; i < route.length; i++) {
    const id = route[i];
    if (remaining[id] > 0) {
      remaining[id]--;
      continue;
    }
    const laterCovered = route.slice(i + 1).some((later) => remaining[later] > 0);
    if (byId[id].optional && laterCovered) continue;
    return byId[id];
  }
  return null;
}

const joinFiles = (files) => files.map((f) => `// ${f.path}\n${f.content}`).join("\n\n");

// One line describing the latest build and test run, as the coach expects.
export function summariseResult(data) {
  const build = data.build;
  if (build?.status === "failed" && (!data.runTime || build.time >= data.runTime)) {
    return "Build failed: " + (build.errors.slice(0, 3).join(" | ") || "unknown error");
  }
  const tests = data.tests || [];
  if (!tests.length) return "No test results yet";
  const failed = tests.filter((t) => t.status === "failed");
  const passed = tests.filter((t) => t.status === "passed").length;
  if (!failed.length) return `All ${passed} tests passed`;
  const details = failed.map((t) => (t.message ? `${t.name} (${t.message.split("\n")[0]})` : t.name));
  return `${failed.length} failed: ${details.join("; ")}; ${passed} passed`;
}

export function buildStep(phase, data, prog, pack = KATA) {
  const files = data.files || [];
  const code = joinFiles(files.filter((f) => f.kind === "production"));
  const step = {
    kata: pack.id,
    phase,
    covered: prog.covered,
    tests: joinFiles(files.filter((f) => f.kind === "test")),
    code,
    test_result: summariseResult(data),
  };
  if (prog.codeAtLastDone !== null && prog.codeAtLastDone !== code) step.code_before = prog.codeAtLastDone;
  return step;
}

export function isGood(verdict) {
  return verdict.rules_ok && ["good", "fine", "n_a"].includes(verdict.ordering);
}

// Updates the per-phase streak and says whether to show this verdict.
export function recordMastery(mastery, phase, verdict) {
  const good = isGood(verdict);
  const wasMastered = (mastery[phase] || 0) >= MASTERY_STREAK;
  mastery[phase] = good ? (mastery[phase] || 0) + 1 : 0;
  return !(good && wasMastered);
}

const ERROR_MESSAGES = {
  403: "The coach doesn't recognise your class code.",
  429: "Your class has used today's coaching allowance.",
  503: "The coach is busy. It will try again on your next step.",
};

// Called when the pair clicks Done on a step. `phase` is the step just finished.
export async function coachStep(phase, helperState) {
  const code = getClassCode();
  if (!COACHED_PHASES.includes(phase) || !code || helperState.status !== "connected" || !helperState.data) return;

  let prog = load(PROGRESS_KEY, emptyProgress());
  const step = buildStep(phase, helperState.data, prog);
  prog = { ...prog, codeAtLastDone: step.code };
  save(PROGRESS_KEY, prog);
  coach.set({ status: "asking", phase, verdict: null, show: true, message: "" });

  try {
    const response = await fetch(coachUrl() + "/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Class-Code": code },
      body: JSON.stringify(step),
    });
    if (!response.ok) {
      const message = ERROR_MESSAGES[response.status] || "The coach couldn't look at this step.";
      coach.set({ status: "error", phase, verdict: null, show: true, message });
      return;
    }
    const verdict = await response.json();

    // Read again: the pair may have started a new game while we waited.
    prog = load(PROGRESS_KEY, emptyProgress());
    if (phase === "red" && KATA.behaviours.some((b) => b.id === verdict.targeted)) {
      prog = { ...prog, covered: [...prog.covered, verdict.targeted] };
      save(PROGRESS_KEY, prog);
      covered.set(prog.covered);
    }
    const mastery = load(MASTERY_KEY, {});
    const show = recordMastery(mastery, phase, verdict);
    save(MASTERY_KEY, mastery);
    coach.set({ status: "done", phase, verdict, show, message: "" });
  } catch {
    coach.set({ status: "error", phase, verdict: null, show: true, message: "Can't reach the coach right now." });
  }
}
