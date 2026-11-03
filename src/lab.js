// The refactor lab (DESIGN-refactor-lab.md B): a pair gets messy code with
// complete passing tests and applies the refactorings from the lecture, one
// at a time:  [REFACTOR] ---> [TEST] ---> [COMMIT] --↺  (swap roles after each commit).
// The starter project's README chooses it:
//   Lab: refactor
//   Refactorings: Extract Function, Rename Variable, Replace Magic Number with Constant
// Everything here is the app's own rules: the lab works without the coach.
import {
  testChanges, testBodies, buildFailed, staleResults, failingTests, currentTests, uncommittedFiles, changedSinceRun,
  oldTestProgram,
} from "./rules.js";
import { codeKey, runMark, NEXT_STEPS_GAP } from "./content/steps.js";
import { namesRefactoring } from "./content/glossary.js";

// When the lab's coach should look again: {due, retryIn}. The TDD game waits
// for a run (steps.js nextStepsDue); the lab looks at each saved change too,
// so a half-done step or a broken change is reviewed before Done, not after
// it. Again on a fresh run after a Look at stale results (the results then
// say something new). At most once every `gap` seconds: retryIn says when a
// change seen during the gap can be looked at. `last`: {round, code, run, stale, at}.
export function labLookDue(last, round, snapshot, nowSec, gap = NEXT_STEPS_GAP) {
  if (!snapshot) return { due: false, retryIn: 0 };
  const changed = !last || last.round !== round || codeKey(snapshot) !== last.code ||
    (last.stale && runMark(snapshot) > last.run && !staleResults(snapshot));
  if (!changed) return { due: false, retryIn: 0 };
  const wait = last ? gap - (nowSec - last.at) : 0;
  return wait > 0 ? { due: false, retryIn: wait } : { due: true, retryIn: 0 };
}

export const LAB_PHASES = ["refactor", "test", "commit"];
// when the README lists none
export const DEFAULT_REFACTORINGS = [
  "Extract Function",
  "Rename Variable",
  "Replace Magic Number with Constant",
  "Decompose Conditional",
];
const LAB_LINE = /^\s*lab\s*:\s*refactor(?:ing)?\s*$/im;
const REFACTORINGS_LINE = /^\s*refactorings\s*:\s*(.+)$/im;
const MAX_REFACTORINGS = 20;

// {refactorings: [names]} when the README chooses the lab, else null.
export function parseLab(readme) {
  const text = String(readme || "");
  if (!LAB_LINE.test(text)) return null;
  const listed = (text.match(REFACTORINGS_LINE)?.[1] || "")
    .split(/[,;]/)
    .map((name) => name.trim().replace(/\.$/, "").slice(0, 60))
    .filter(Boolean);
  return { refactorings: (listed.length ? [...new Set(listed)] : DEFAULT_REFACTORINGS).slice(0, MAX_REFACTORINGS) };
}

// "Smells first" (the worksheet's section 1): when the project has a smells.md,
// the coach's board stays hidden until the pair has listed smells of their own
// there: lines that weren't in it when the lab started.
export const MIN_OWN_SMELLS = 3;
const listLines = (text) =>
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
// With a table (the worksheet's smell log), only its rows count, and only rows
// with something in them: not an empty template row, nor the pair's names.
const isRow = (l) => l.startsWith("|");
const rowHasContent = (l) => /[^|\s:-]/.test(l);
export function ownSmellsListed(start, now) {
  const before = new Set(listLines(start));
  const table = listLines(start).some(isRow);
  const count = listLines(now).filter((l) => !before.has(l) && (!table || (isRow(l) && rowHasContent(l)))).length;
  return { count, enough: count >= MIN_OWN_SMELLS };
}

// The production code, to tell whether it changed since the round began.
const productionCode = (snapshot, kinds = ["production"]) =>
  (snapshot?.files || [])
    .filter((f) => kinds.includes(f.kind))
    .map((f) => `${f.path}\n${f.content}`)
    .join("\n");

export const productionChanged = (base, now) => productionCode(now) !== productionCode(base);
// A Develop step may change the tests alone (relax one first, then the code)
export const codeChanged = (base, now) =>
  productionCode(now, ["production", "test"]) !== productionCode(base, ["production", "test"]);

// A test edit that only follows the production code is still the same test:
// a renamed name (Ctrl+R, Ctrl+R renames in test.cpp too), or a literal
// replaced by a new constant with that value (`-1` → `ConnectFour::NoMove`).
// A literal never runs past the end of its line.
const TOKEN = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|[A-Za-z_]\w*|\d[\w.]*|::|\S/g;
const tokens = (text) => stripComments(text).match(TOKEN) || [];

// The code without its comments; string and character literals kept. An
// apostrophe in a comment ("the players' pieces") would otherwise open a
// character literal that swallows the code after it, and hide a rename.
export const stripComments = (text) =>
  String(text || "").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) =>
    m[0] === "/" ? " " : m
  );
const NAME = /^[A-Za-z_]\w*$/;
const LITERAL = /^(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\d[\w.]*)$/;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// [{was: [tokens], is: [tokens]}]: the runs of tokens that differ, from an LCS (test bodies are short).
function hunks(a, b) {
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0, j = 0, hunk = null;
  const flush = () => hunk && (out.push(hunk), (hunk = null));
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      i++, j++;
    } else {
      hunk ||= { was: [], is: [] };
      if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) hunk.is.push(b[j++]);
      else hunk.was.push(a[i++]);
    }
  }
  flush();
  return out;
}

// Whether every difference between a test's old and new body follows the production code.
function followsCode(was, is, oldNames, newNames, code) {
  return hunks(tokens(was), tokens(is)).every(({ was, is }) => {
    // the new side: one name, maybe qualified (ConnectFour::NoMove), that the production code just gained
    const name = is[is.length - 1];
    const qualified = is.every((t, k) => (k % 2 ? t === "::" : NAME.test(t))) && is.length % 2 === 1;
    if (!qualified || !newNames.has(name)) return false;
    // renamed: the old name is gone from the production code
    if (was.length === 1 && oldNames.has(was[0])) return true;
    // a magic number made a constant: the constant has the literal's value
    const literal = was.join("");
    if (!LITERAL.test(was[was.length - 1]) || !(was.length === 1 || (was.length === 2 && was[0] === "-"))) return false;
    return new RegExp(`\\b${escape(name)}\\s*(?:=|\\{|\\()\\s*${escape(literal)}(?![\\w.])`).test(code);
  });
}

const namesIn = (code) => new Set(tokens(code).filter((t) => NAME.test(t)));

// The tests the pair changed beyond following the code: {added, removed, changed}.
// `start` is the code as the lab began: a test can follow a rename (or a new
// constant) committed in an earlier round, e.g. a pair who renamed move() in
// round 1 but only fixed the tests that still called it in round 2.
export function labTestChanges(base, now, start = null) {
  const c = testChanges(base, now);
  if (!c.changed.length) return c;
  const code = stripComments(productionCode(now));
  const is = namesIn(code);
  const oldNames = new Set();
  const newNames = new Set();
  for (const from of start ? [base, start] : [base]) {
    const was = namesIn(productionCode(from));
    for (const n of was) if (!is.has(n)) oldNames.add(n);
    for (const n of is) if (!was.has(n)) newNames.add(n);
  }
  const before = testBodies(base);
  const after = testBodies(now);
  return { ...c, changed: c.changed.filter((name) => !followsCode(before[name], after[name], oldNames, newNames, code)) };
}

const testsUnchanged = (base, now, start) => {
  const c = labTestChanges(base, now, start);
  return !c.added.length && !c.removed.length && !c.changed.length;
};

// A lab phase's to-do list, against `base` (the code at the last commit, or at
// the start): [{text, ok, reason?, why?}]. The text is the task and never changes;
// ok true = done, false = a problem (reason says what), null = not done yet.
// `why`, on an item not done: how the app checked it, for "Why can't we go on?".
// goalMet when every item is done, so Done may be clicked.
const WHY_UNCHANGED =
  "The app compares the production code (the .cpp and .h files that aren't tests) with the last commit " +
  "(or the start of the lab) and sees no difference. Saved your files? The helper picks up a save within about 5 seconds.";
// A CMake project leaves no build log, so a failed build only shows as a test
// program older than the code (rules.js oldTestProgram): say what that means.
const OLD_PROGRAM_RAN =
  "The last run used the test program from before your last saved change: it wasn't rebuilt " +
  "(running the tests without building runs the old program), or the build failed. Build, then run the tests.";
const OLD_PROGRAM_NO_RUN =
  "The test results are older than your last saved change, and so is the test program. " +
  "If you have run the tests since, the build probably failed: look at the build output for its first error.";
const whyRun = (now) =>
  buildFailed(now)
    ? "The newest build log has errors."
    : !currentTests(now).length
    ? "The app hasn't seen any test results yet."
    : staleResults(now) && oldTestProgram(now)
    ? changedSinceRun(now) ? OLD_PROGRAM_NO_RUN : OLD_PROGRAM_RAN
    : staleResults(now)
    ? "The test results are older than your last saved change, so they don't show the code as it is now: run the tests again."
    : `The last run has failing tests: ${failingTests(now).join(", ")}.`;
// The run line's short reason when the test program wasn't rebuilt, or null.
const oldProgramReason = (now) =>
  buildFailed(now) || !oldTestProgram(now) || !currentTests(now).length
    ? null
    : changedSinceRun(now)
    ? "No new results yet. If the build failed, fix its first error (or undo the change)"
    : "That run tested the old program: build, then run the tests again. If the build fails, fix its first error";

// Options: `start` (the code as the lab began, labTestChanges), `develop` (a
// Develop round: its commit says what changed rather than naming a
// refactoring) and `refactorings` (the lab's list, for the commit message).
export function labStatus(phase, base, now, { start = null, develop = false, refactorings = [] } = {}) {
  if (!now) return null;
  const lines = [];
  const testsLine = { text: "Keep the tests the same (renames are fine)", ok: true };
  if (!testsUnchanged(base, now, start)) {
    const c = labTestChanges(base, now, start);
    const changed = [
      ...c.added.map((n) => `${n} (added)`),
      ...c.removed.map((n) => `${n} (removed)`),
      ...c.changed.map((n) => `${n} (changed)`),
    ];
    Object.assign(testsLine, {
      ok: false,
      reason: "You changed what a test checks: put it back",
      testsHold: true,
      why:
        `Compared with the last commit: ${changed.join(", ")}. A rename, or a new constant in place of a literal, ` +
        "carried into a test is allowed; any other change to a test counts as changing what it checks.",
    });
  }
  if (phase === "refactor") {
    const made = productionChanged(base, now);
    lines.push({ text: "Make one refactoring in the production code", ok: made || null, ...(made ? {} : { why: WHY_UNCHANGED }) });
    lines.push(testsLine);
  } else if (phase === "test") {
    lines.push(testsLine);
    const run = { text: "Run all the tests (Ctrl+R, A): every test passes", ok: true, howto: "run_tests" };
    if (buildFailed(now) || staleResults(now) || !currentTests(now).length || failingTests(now).length) run.why = whyRun(now);
    if (buildFailed(now)) Object.assign(run, { ok: false, reason: "The code doesn't build: fix it, or undo the last change" });
    else if (staleResults(now) || !currentTests(now).length) {
      run.ok = null;
      // ran, but the old program: a problem to fix, not just a run still to do
      const old = oldProgramReason(now);
      if (old) Object.assign(run, { reason: old, ok: changedSinceRun(now) ? null : false });
    } else if (failingTests(now).length)
      Object.assign(run, {
        ok: false,
        reason: `${failingTests(now).join(", ")} fails: undo the last change, then run the tests again`,
        testsHold: true,
      });
    lines.push(run);
  } else if (phase === "develop") {
    // The pair said they're changing behaviour: failing tests and edited
    // tests are expected, so nothing here holds them; every test green ends it.
    const changed = codeChanged(base, now);
    lines.push({
      text: "Change what the code does, and the tests that check the old behaviour",
      ok: changed || null,
      ...(changed ? {} : { why: WHY_UNCHANGED.replace("that aren't tests", "and the tests") }),
    });
    // a test that checks the old behaviour is changed, not deleted: fewer tests
    // than at the last commit means some went (a rename is one out, one in)
    const { added, removed } = testChanges(base, now);
    if (removed.length > added.length)
      lines.push({
        text: "Keep the tests: change the ones that check the old behaviour, don't delete them",
        ok: false,
        reason: `Deleted: ${removed.slice(0, 3).join(", ")}${removed.length > 3 ? "…" : ""}. Put it back and change what it checks`,
        why:
          `Compared with the last commit, ${removed.length} test${removed.length === 1 ? " is" : "s are"} gone and ` +
          `${added.length} new. A test for behaviour the step changes should check the new behaviour, not disappear.`,
      });
    const run = { text: "Run all the tests (Ctrl+R, A): every test passes again", ok: true, howto: "run_tests" };
    if (buildFailed(now) || staleResults(now) || !currentTests(now).length || failingTests(now).length || !changed)
      run.why = changed ? whyRun(now) : "Nothing has changed since the last commit yet, so a run says nothing about this step.";
    // tests written first (e.g. for a class that isn't there yet) don't build: that's this step's red
    if (buildFailed(now))
      Object.assign(run, {
        ok: null,
        reason: "The code doesn't build yet. Expected if you wrote the tests first: carry on until it builds and every test passes.",
      });
    else if (staleResults(now) || !currentTests(now).length || !codeChanged(base, now)) {
      run.ok = null;
      if (changed && oldProgramReason(now)) run.reason = oldProgramReason(now);
    }
    else if (failingTests(now).length)
      Object.assign(run, { ok: null, reason: `Still failing, as you expected: ${failingTests(now).join(", ")}. Carry on until every test passes.` });
    lines.push(run);
  } else if (phase === "commit") {
    const git = now.git;
    if (!git?.repo) lines.push({ text: "Commit if you can (no git repository, so it can't be checked)", ok: true });
    else {
      const moved = !!git.head && git.head !== base?.git?.head;
      const text = develop ? "Commit, with a message that says what changed" : "Commit, with a message that names the refactoring";
      const commit = { text, ok: moved || null, howto: "commit" };
      if (!moved)
        commit.why =
          `git's newest commit is still the one this round started from (${String(base?.git?.head || "none").slice(0, 8)}). ` +
          "Committed in another folder or repository, or not pushed the commit button yet? The helper checks git every 5 seconds.";
      // "fixed stuff" passed before (battle test 2026-11-03): the message has to name the refactoring
      else if (!develop && !namesRefactoring(git.headMessage, refactorings))
        Object.assign(commit, {
          ok: false,
          reason: `"${String(git.headMessage || "").slice(0, 60)}" doesn't say which refactoring: reword the commit`,
          howto: "amend",
          why:
            "The message should start with the refactoring's name, then where, e.g. \"Rename Variable: c and p in play\". " +
            `This lab's refactorings: ${refactorings.join(", ") || "see the start page"}.`,
        });
      lines.push(commit);
      const dirty = uncommittedFiles(now);
      const left = { text: "Leave nothing uncommitted", ok: !dirty.length || (moved ? false : null) };
      if (dirty.length) {
        left.reason = `Not committed yet: ${dirty.slice(0, 3).join(", ")}${dirty.length > 3 ? "…" : ""}`;
        left.why = `git status lists these source files as changed since the last commit: ${dirty.join(", ")}.`;
      }
      lines.push(left);
    }
  }
  return { lines, goalMet: lines.length > 0 && lines.every((l) => l.ok === true) };
}

// What each lab phase's card says when nothing more specific applies.
export const LAB_CARDS = {
  refactor: {
    title: "Refactor",
    driver: "Pick one smell and apply one refactoring from the list. Change only the production code.",
    navigator: "Name the refactoring you're doing, and stop the driver from doing a second one.",
    done: "Done: one refactoring made",
  },
  test: {
    title: "Test",
    driver: "Build and run all the tests (Ctrl+R, A).",
    navigator: "Check every test is still green. If one fails, say: undo the last change.",
    howto: "run_tests",
    done: "Done: every test passes",
  },
  commit: {
    title: "Commit",
    driver: "Commit, with a message that names the refactoring and what it changed (e.g. 'Extract Function: …').",
    navigator: "Check nothing else slipped into the commit. Then you swap roles.",
    howto: "commit",
    done: "Done: committed",
  },
  // A Develop step inside the lab, chosen by the pair (gameState.labDevelop):
  // DEVELOP ---> COMMIT, then back to refactoring.
  develop: {
    title: "Develop",
    driver: "Change what the code does. Tests that checked the old behaviour will fail: change them to check the new one.",
    navigator: "Before each run, say which tests should fail and why. A test you didn't expect to fail means a mistake.",
    howto: "run_tests",
    done: "Done: all green, back to refactoring",
    commit: "Commit, with a message that says what the code does now (e.g. 'Develop: any legal move, not just the first').",
  },
};
