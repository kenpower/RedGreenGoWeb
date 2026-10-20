// The step catalogue: every action a novice may need in Red, Green or
// Refactor, with fixed, reviewed texts. The coach only picks and orders ids
// from it (coach/next_steps.md), so what the pair reads is always one of these.
//
// {id, phase, text, why?, required, check?(before, now, live) → true | false | null}
//   required: needed to move on (shown under "Needed to move on"); otherwise
//             good practice, never blocking and never shown as ✖.
//   check:    ticks the step live from the helper's data; null = can't tell.
import {
  pickRedTest, callsCode, testBodies, buildFailed, failingTests, changedSinceRun, isVagueTestName,
  untestedFunctions, testChanges, testNames, passedFirstTest,
} from "../rules.js";

const results = (snapshot) => Object.fromEntries((snapshot?.tests || []).map((t) => [t.name, t.status]));
const fresh = (now) => !!now && !changedSinceRun(now);
// this Red's test, or null when there isn't one (yet)
const redTest = (before, now) => {
  if (!before || !now) return null;
  const pick = pickRedTest(before, now);
  return pick.problem ? null : pick.name;
};
const redBody = (before, now) => testBodies(now)[redTest(before, now)] || "";
const ranRed = (before, now) => {
  const name = redTest(before, now);
  return !!name && fresh(now) && (buildFailed(now) || name in results(now));
};

export const STEPS = [
  // ---- Red ----------------------------------------------------------------
  {
    id: "red.call_missing_function",
    phase: "red",
    required: true,
    text: "Write ONE test that calls a function that doesn't exist yet, named after what it should do",
    why: "The test describes the code before it exists.",
    check: (b, n) => (redTest(b, n) ? callsCode(redBody(b, n)) : null),
  },
  {
    id: "red.call_your_code",
    phase: "red",
    required: true,
    text: "Make the test call your code, not just check true or false",
    why: "A test that calls nothing can't tell you anything about your code.",
    check: (b, n) => (redTest(b, n) ? callsCode(redBody(b, n)) : null),
  },
  {
    id: "red.add_assertion",
    phase: "red",
    required: true,
    text: "Add an EXPECT_EQ (or EXPECT_TRUE) that checks the result",
    why: "Without an assertion the test can't fail.",
    check: (b, n) => (redTest(b, n) ? /\b(?:EXPECT|ASSERT)_\w+/.test(redBody(b, n)) : null),
  },
  {
    id: "red.one_test_only",
    phase: "red",
    required: true,
    text: "Keep just one new test: comment out the others for now",
    why: "One failing test at a time keeps each step small.",
    check: (b, n) => (b && n ? pickRedTest(b, n).problem?.rule !== "several_new_tests" : null),
  },
  {
    id: "red.make_it_fail_for_right_reason",
    phase: "red",
    required: true,
    text: "Make the test check something your code doesn't do yet, so it fails for the right reason",
    why: "The failing test proves it really checks something.",
    check: (b, n) => (ranRed(b, n) ? buildFailed(n) || results(n)[redTest(b, n)] === "failed" : null),
  },
  {
    id: "red.run_tests",
    phase: "red",
    required: true,
    text: "Run all tests: Test → Run All Tests (Ctrl+R, A)",
    check: (b, n) => (redTest(b, n) ? ranRed(b, n) : null),
  },
  {
    id: "red.see_it_fail",
    phase: "red",
    required: true,
    text: "Check it fails. 'Doesn't compile' counts, because the function doesn't exist yet",
    check: (b, n, live) => (ranRed(b, n) ? live?.lines?.[0]?.ok === true : null),
  },
  {
    id: "red.new_test_passes_already",
    phase: "red",
    required: true,
    text: "Your new test passed straight away: your code already does this, or the test doesn't check what you think",
    why: "A Red test has to fail first, or it proves nothing.",
    check: (b, n) => (redTest(b, n) && ranRed(b, n) ? !passedFirstTest(b, n) : null),
  },
  {
    id: "red.pick_new_behaviour",
    phase: "red",
    required: true,
    text: "Pick a behaviour your code doesn't do yet, and test that instead",
    check: (b, n) => (redTest(b, n) && ranRed(b, n) ? !passedFirstTest(b, n) : null),
  },
  {
    id: "red.prove_test_can_fail",
    phase: "red",
    required: false,
    text: "Temporarily break the function so it returns something wrong, run the tests, see the test fail, then undo it",
    why: "It shows the test really checks your code.",
  },
  {
    id: "red.fix_typo",
    phase: "red",
    required: true,
    text: "Fix the typo in the test, so it only fails because the code isn't written yet",
    why: "A test that fails for the wrong reason proves nothing.",
  },
  {
    id: "red.fix_other_failure",
    phase: "red",
    required: true,
    text: "Make the other failing test pass again, or comment it out",
    why: "Only this Red's test may fail.",
    check: (b, n) => (fresh(n) && !buildFailed(n) ? failingTests(n).filter((t) => t !== redTest(b, n)).length === 0 : null),
  },
  {
    id: "red.fix_assertion",
    phase: "red",
    required: true,
    text: "Fix the assertion so it checks what the test's name says",
  },
  {
    id: "red.declare_function",
    phase: "red",
    required: false,
    text: "Declare the function in your header (no body yet), so the test compiles and fails on the assertion",
    why: "Some teams prefer a failing assertion to a compile error.",
  },
  {
    id: "red.include_header",
    phase: "red",
    required: false,
    text: "Add #include for the header where the function will live",
  },
  {
    id: "red.simplest_case",
    phase: "red",
    required: false,
    text: "Start with the simplest case: empty input, zero, or a single item",
    why: "Simple cases first make each Green step small.",
  },
  {
    id: "red.one_behaviour",
    phase: "red",
    required: false,
    text: "Check one behaviour per test (several examples of it are fine)",
  },
  {
    id: "red.rename_test",
    phase: "red",
    required: false,
    text: "Rename the test to say what it checks",
    why: "A good name tells you what broke when it fails.",
    check: (b, n) => (redTest(b, n) ? !isVagueTestName(redTest(b, n)) : null),
  },
  {
    id: "red.remove_code_before_test",
    phase: "red",
    required: false,
    text: "Delete code written before its test, and let the tests drive it",
    why: "In TDD the test comes first.",
    check: (b, n) => (n ? untestedFunctions(n).length === 0 : null),
  },
  {
    id: "red.say_it_first",
    phase: "red",
    required: false,
    text: "Navigator: say out loud what this test should check before the driver types",
  },
  {
    id: "red.next_example",
    phase: "red",
    required: false,
    text: "Pick the next example your code gets wrong, just one",
  },

  // ---- Green --------------------------------------------------------------
  {
    id: "green.create_function",
    phase: "green",
    required: true,
    text: "Create the function the test calls, with the same name and parameters",
    check: (b, n) => (fresh(n) ? !buildFailed(n) : null),
  },
  {
    id: "green.add_include",
    phase: "green",
    required: false,
    text: "Add #include for your header to the test file, if the build can't find the function",
    why: "Adding an #include doesn't count as changing the tests.",
  },
  {
    id: "green.make_it_compile",
    phase: "green",
    required: true,
    text: "Make the code build: fix the compile errors one at a time, starting with the first",
    check: (b, n) => (n && n.build ? !buildFailed(n) : null),
  },
  {
    id: "green.fake_it",
    phase: "green",
    required: false,
    text: "Return the exact expected value if that's all this test needs",
    why: "The next test will force a real solution.",
  },
  {
    id: "green.least_code",
    phase: "green",
    required: true,
    text: "Write the least code that makes the failing test pass",
    check: (b, n, live) => {
      const focus = live?.focusTest;
      return focus && fresh(n) && !buildFailed(n) && focus in results(n) ? results(n)[focus] === "passed" : null;
    },
  },
  {
    id: "green.no_extra",
    phase: "green",
    required: false,
    text: "Don't add behaviour no test asks for yet",
    why: "Untested code is code you can't trust.",
  },
  {
    id: "green.remove_extra",
    phase: "green",
    required: true,
    text: "Take out the code no test asks for yet",
  },
  {
    id: "green.leave_tests",
    phase: "green",
    required: true,
    text: "Don't change the tests in this step",
    check: (b, n) => {
      if (!b || !n) return null;
      const c = testChanges(b, n);
      return c.added.length + c.removed.length + c.changed.length === 0;
    },
  },
  {
    id: "green.run_tests",
    phase: "green",
    required: true,
    text: "Run all tests: Test → Run All Tests (Ctrl+R, A)",
    check: (b, n) => (n ? fresh(n) && (n.tests || []).length > 0 : null),
  },
  {
    id: "green.all_green",
    phase: "green",
    required: true,
    text: "See every test pass, not just the new one",
    check: (b, n) => (fresh(n) && !buildFailed(n) && (n.tests || []).length ? failingTests(n).length === 0 : null),
  },
  {
    id: "green.keep_old_tests_passing",
    phase: "green",
    required: true,
    text: "Fix the change that broke an older test",
  },

  // ---- Refactor -----------------------------------------------------------
  {
    id: "refactor.remove_duplication",
    phase: "refactor",
    required: false,
    text: "Remove duplication: code that's repeated, or ifs that could become one rule",
  },
  {
    id: "refactor.rename",
    phase: "refactor",
    required: false,
    text: "Rename anything a reader would have to puzzle over",
  },
  {
    id: "refactor.extract_function",
    phase: "refactor",
    required: false,
    text: "Pull a piece with a clear job out into its own small function",
  },
  {
    id: "refactor.tidy_tests",
    phase: "refactor",
    required: false,
    text: "Tidy the tests too, keeping what they check the same",
  },
  {
    id: "refactor.rename_tests",
    phase: "refactor",
    required: false,
    text: "Give vaguely named tests names that say what they check",
    check: (b, n) => (n ? [...testNames(n)].every((t) => !isVagueTestName(t)) : null),
  },
  {
    id: "refactor.small_steps",
    phase: "refactor",
    required: false,
    text: "Change one small thing at a time, and run the tests after each",
  },
  {
    id: "refactor.nothing_yet",
    phase: "refactor",
    required: false,
    text: "Nothing worth changing yet? That's fine this early",
  },
  {
    id: "refactor.undo",
    phase: "refactor",
    required: true,
    text: "Undo the last change so all tests pass again",
  },
  {
    id: "refactor.same_tests",
    phase: "refactor",
    required: true,
    text: "Keep the same tests: no tests added or removed",
    check: (b, n) => (b && n ? testChanges(b, n).added.length + testChanges(b, n).removed.length === 0 : null),
  },
  {
    id: "refactor.run_tests",
    phase: "refactor",
    required: true,
    text: "Run all tests: Test → Run All Tests (Ctrl+R, A)",
    check: (b, n) => (n ? fresh(n) : null),
  },
  {
    id: "refactor.still_green",
    phase: "refactor",
    required: true,
    text: "Check every test still passes",
    check: (b, n) => (fresh(n) && !buildFailed(n) && (n.tests || []).length ? failingTests(n).length === 0 : null),
  },
  {
    id: "refactor.commit",
    phase: "refactor",
    required: false,
    text: "Commit: this cycle is done",
    why: "Small commits make it easy to go back.",
    check: (b, n) => (n?.git?.repo ? (n.git.dirtySource || []).length === 0 : null),
  },
];

// ---- When to ask the coach for next steps ---------------------------------
export const NEXT_STEPS_GAP = 60; // seconds: at most one ask a minute per pair

// The latest test run or build the helper reported (epoch seconds), or 0.
export const runMark = (snapshot) => Math.max(snapshot?.runTime || 0, snapshot?.build?.time || 0);

// A cheap fingerprint of the source, to tell whether the code changed.
export function codeKey(snapshot) {
  let hash = 5381;
  for (const f of snapshot?.files || []) {
    const text = f.path + "\0" + (f.content || "");
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}

// Whether to ask the coach for next steps now. `last` is the previous ask,
// {step, run, code, at} or null. Ask on the first look at a step (once there
// are results), then again only when a new run or build arrives AND the code
// changed since the last look. Never more than once every NEXT_STEPS_GAP
// seconds, across steps.
export function nextStepsDue(last, stepNumber, snapshot, nowSec, gap = NEXT_STEPS_GAP) {
  const run = runMark(snapshot);
  if (!run) return false;
  if (last && nowSec - last.at < gap) return false;
  if (!last || last.step !== stepNumber) return true;
  return run > last.run && codeKey(snapshot) !== last.code;
}

const BY_ID = Object.fromEntries(STEPS.map((s) => [s.id, s]));
export const stepById = (id) => BY_ID[id] || null;

// What the coach chooses from: [{id, text}] for one phase.
export const catalogueFor = (phase) => STEPS.filter((s) => s.phase === phase).map(({ id, text }) => ({ id, text }));

// The card's two groups, in the coach's order: "Needed to move on" (required,
// ticked by their checks, ✖ when a check fails) and "Good practice" (optional,
// ticked when a check passes, never ✖). `chosen` is the coach's
// [{id, detail}] (detail: an instruction for this code, or ""). The coach's
// free-text extra goes at the end of its group, without a tick.
export function groupSteps(phase, chosen, extra, before, now, live) {
  const needed = [];
  const practice = [];
  for (const item of chosen || []) {
    const { id, detail = "" } = typeof item === "string" ? { id: item } : item;
    const step = BY_ID[id];
    if (!step || step.phase !== phase) continue;
    let done = step.check ? step.check(before, now, live) : null;
    if (!step.required && done === false) done = null; // good practice never shows ✖
    (step.required ? needed : practice).push({ id, text: step.text, detail, why: step.why, done });
  }
  if (extra?.text) (extra.needed ? needed : practice).push({ id: "extra", text: extra.text, done: null, extra: true });
  const current = needed.findIndex((s) => s.done !== true);
  if (current >= 0) needed[current] = { ...needed[current], current: true };
  return { needed, practice };
}
