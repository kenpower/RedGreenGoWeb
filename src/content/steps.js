// The step catalogue: every action a novice may need in Red, Green or
// Refactor, with fixed, reviewed texts. The coach only picks and orders ids
// from it (coach/next_steps.md), so what the pair reads is always one of these.
//
// {id, phase, text, why?, navigator?, required, check?(before, now, live) → true | false | null,
//  applies(before, now, live, {novice}) → bool}
//   required:  needed to move on (shown under "Needed to move on"); otherwise
//              good practice, never blocking and never shown as ✖.
//   check:     ticks the step live from the helper's data; null = can't tell.
//   applies:   whether the step fits the code as it is now, for the picker
//              used without the coach (pickSteps). Steps only the coach can
//              judge (a typo, a backwards assertion) never apply here.
//   navigator: what the navigator does meanwhile, for the step card.
// `applies` and `navigator` live in FIT below, keyed by id, so all the "when
// does this step fit" rules can be read (and reviewed) together.
import {
  pickRedTest, callsCode, testBodies, buildFailed, failingTests, changedSinceRun, isVagueTestName,
  untestedFunctions, testChanges, testNames, passedFirstTest, currentTests, staleResults,
} from "../rules.js";

// only tests still in the source count (rules.currentTests)
const results = (snapshot) => Object.fromEntries(currentTests(snapshot).map((t) => [t.name, t.status]));
const ranAny = (snapshot) => currentTests(snapshot).length > 0;
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
    why: "The failing test proves it really checks something.",
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
    id: "red.fill_in_or_delete_stub",
    phase: "red",
    required: false,
    text: "Leave the empty function (stub) as it is until a failing test needs it, or delete it",
    why: "Code should only grow when a failing test asks for it.",
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
    text: "Write the least code that makes the failing test pass. Returning the exact expected value is allowed",
    why: "The next test will force a real solution.",
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
    check: (b, n) => (n ? fresh(n) && ranAny(n) && !staleResults(n) : null),
  },
  {
    id: "green.all_green",
    phase: "green",
    required: true,
    text: "See every test pass, not just the new one",
    check: (b, n) => (fresh(n) && !buildFailed(n) && ranAny(n) ? failingTests(n).length === 0 : null),
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
    check: (b, n) => (fresh(n) && !buildFailed(n) && ranAny(n) ? failingTests(n).length === 0 : null),
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

// ---- When each step fits the code (for the picker without the coach) --------
// (a function declaration: nextStepsDue below uses it too)
function hasCode(snapshot) {
  return (snapshot?.files || []).some((f) => (f.content || "").trim());
}
const bodies = (now) => Object.values(testBodies(now));
// some test calls the pair's code (not just VS's template or EXPECT_TRUE(true))
const anyTestCallsCode = (now) => bodies(now).some((body) => callsCode(body));
const allRunAndGreen = (now) =>
  fresh(now) && !buildFailed(now) && ranAny(now) && failingTests(now).length === 0;
const buildErrors = (now) => (buildFailed(now) ? now.build.errors || [] : []);
const missingName = (now) => buildErrors(now).some((e) => /identifier not found|undeclared identifier|is not a member/.test(e));
const notRunYet = (b, n) => {
  const name = redTest(b, n);
  return !!name && !buildFailed(n) && !(name in results(n));
};
const assertions = (body) => (body.match(/\b(?:EXPECT|ASSERT)_\w+/g) || []).length;
// empty or trivial functions (a stub: {} or a bare return)
const STUB = /\b([A-Za-z_]\w*)\s*\([^;{}()]*\)\s*(?:const\s*)?\{\s*(?:return\b[^;{}]*;)?\s*\}/g;
const hasStub = (now) =>
  (now?.files || []).some((f) => f.kind === "production" && [...(f.content || "").matchAll(STUB)].some((m) => !/^(?:if|for|while|switch)$/.test(m[1])));
const focusOf = (live) => live?.focusTest || null;
const focusPasses = (n, live) => !!focusOf(live) && fresh(n) && !buildFailed(n) && results(n)[focusOf(live)] === "passed";
const testsChanged = (b, n) => {
  if (!b || !n) return false;
  const c = testChanges(b, n);
  return c.added.length + c.removed.length + c.changed.length > 0;
};

const FIT = {
  // Red
  "red.new_test_passes_already": { applies: (b, n) => !!passedFirstTest(b, n) },
  "red.pick_new_behaviour": {
    applies: (b, n) => !!passedFirstTest(b, n),
    navigator: "Suggest an input the code gets wrong today.",
  },
  "red.call_missing_function": {
    applies: (b, n) => !anyTestCallsCode(n),
    navigator: "Say what the function should be called and what the first test should check.",
  },
  "red.call_your_code": {
    applies: (b, n) => !!redTest(b, n) && !callsCode(redBody(b, n)),
    navigator: "Check the test calls your code, not just true or false.",
  },
  "red.add_assertion": {
    applies: (b, n) => !!redTest(b, n) && callsCode(redBody(b, n)) && assertions(redBody(b, n)) === 0,
    navigator: "Ask what result the test expects.",
  },
  "red.one_test_only": {
    applies: (b, n) => !!b && !!n && pickRedTest(b, n).problem?.rule === "several_new_tests",
    navigator: "Agree which test is the smallest next step.",
  },
  "red.make_it_fail_for_right_reason": {
    // a test already calls existing code and everything passes, with no new or changed test yet
    applies: (b, n) => !redTest(b, n) && anyTestCallsCode(n) && allRunAndGreen(n),
    navigator: "Suggest a case your code doesn't handle yet.",
  },
  "red.run_tests": {
    applies: (b, n) => !!redTest(b, n) && (changedSinceRun(n) || notRunYet(b, n)),
    navigator: "Watch the results come in.",
  },
  "red.see_it_fail": {
    applies: (b, n) => !!redTest(b, n) && !passedFirstTest(b, n),
    navigator: "Read the failure message aloud: is it the reason you expected?",
  },
  "red.fix_typo": { applies: () => false }, // the coach's call
  "red.fix_other_failure": {
    applies: (b, n) => fresh(n) && !buildFailed(n) && failingTests(n).some((t) => t !== redTest(b, n)) && !!redTest(b, n),
    navigator: "Check only this Red's test is failing.",
  },
  "red.fix_assertion": { applies: () => false }, // the coach's call
  "red.fill_in_or_delete_stub": { applies: (b, n) => hasStub(n) },
  "red.declare_function": { applies: (b, n) => !!redTest(b, n) && missingName(n) },
  "red.include_header": { applies: () => false },
  "red.simplest_case": { applies: (b, n) => !anyTestCallsCode(n) },
  "red.one_behaviour": { applies: (b, n) => !!redTest(b, n) && assertions(redBody(b, n)) > 2 },
  "red.rename_test": { applies: (b, n) => [...testNames(n)].some((t) => isVagueTestName(t)) },
  "red.remove_code_before_test": { applies: (b, n) => untestedFunctions(n).length > 0 },
  "red.prove_test_can_fail": { applies: (b, n) => !!passedFirstTest(b, n) },
  "red.say_it_first": { applies: (b, n, live, o) => !!o?.novice && !redTest(b, n) },
  "red.next_example": { applies: (b, n) => !redTest(b, n) && anyTestCallsCode(n) },

  // Green
  "green.create_function": {
    applies: (b, n) => missingName(n),
    navigator: "Check the name and parameters match the test's call.",
  },
  "green.add_include": { applies: (b, n) => missingName(n) },
  "green.make_it_compile": {
    applies: (b, n) => buildFailed(n) && !missingName(n),
    navigator: "Read the first error aloud and find the line it points to.",
  },
  "green.fake_it": { applies: (b, n, live) => !!focusOf(live) && !focusPasses(n, live) },
  "green.least_code": {
    applies: (b, n, live) => !buildFailed(n) && !focusPasses(n, live),
    navigator: "Watch for code the test doesn't need.",
  },
  "green.no_extra": { applies: (b, n, live, o) => !!o?.novice },
  "green.remove_extra": { applies: () => false }, // the coach's call
  "green.leave_tests": {
    applies: (b, n, live, o) => testsChanged(b, n) || !!o?.novice,
    navigator: "Check only production code changes (an #include is fine).",
  },
  "green.run_tests": {
    applies: (b, n) => !!n && (changedSinceRun(n) || !ranAny(n) || staleResults(n)),
    navigator: "Check every test is green before moving on.",
  },
  "green.all_green": { applies: () => true, navigator: "Check every test is green, not just the new one." },
  "green.keep_old_tests_passing": {
    applies: (b, n, live) => fresh(n) && !buildFailed(n) && failingTests(n).some((t) => t !== focusOf(live)),
    navigator: "Find which change broke the older test.",
  },

  // Refactor
  "refactor.remove_duplication": { applies: (b, n) => !!n && hasCode(n) },
  "refactor.rename": { applies: (b, n) => !!n && hasCode(n) },
  "refactor.extract_function": { applies: () => false },
  "refactor.tidy_tests": { applies: () => false },
  "refactor.rename_tests": { applies: (b, n) => [...testNames(n)].some((t) => isVagueTestName(t)) },
  "refactor.small_steps": { applies: (b, n, live, o) => !!o?.novice },
  "refactor.nothing_yet": { applies: (b, n, live, o) => !!o?.novice },
  "refactor.undo": {
    applies: (b, n) => buildFailed(n) || (fresh(n) && failingTests(n).length > 0),
    navigator: "Suggest a smaller change to try next.",
  },
  "refactor.same_tests": {
    applies: (b, n) => !!b && !!n && (testChanges(b, n).added.length + testChanges(b, n).removed.length > 0),
    navigator: "Check the same tests still run.",
  },
  "refactor.run_tests": {
    applies: (b, n) => !!n && changedSinceRun(n),
    navigator: "Check every test is green before moving on.",
  },
  "refactor.still_green": { applies: () => true, navigator: "Point out one thing worth tidying, or agree there's nothing yet." },
  "refactor.commit": { applies: (b, n) => !!n?.git?.repo },
};

for (const step of STEPS) Object.assign(step, FIT[step.id] || { applies: () => false });

const MAX_PICKED = 5;
const MIN_PICKED = 2;

// Without the coach (or before it answers): the steps that fit the code now,
// in catalogue order, required ones first, 2–5 of them. Same shape as the
// coach's answer ([{id, detail}]), with no details.
export function pickSteps(phase, before, now, live, { novice = false } = {}) {
  const fits = STEPS.filter((s) => s.phase === phase && s.applies(before, now, live, { novice }));
  const required = fits.filter((s) => s.required);
  const optional = fits.filter((s) => !s.required);
  // fill up with good practice: more of it for novices, at most one later on
  const room = Math.max(MIN_PICKED - required.length, novice ? MAX_PICKED - required.length : 1);
  return [...required.slice(0, MAX_PICKED), ...optional.slice(0, Math.max(0, Math.min(room, MAX_PICKED - required.length)))]
    .map((s) => ({ id: s.id, detail: "" }));
}

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
// {step, run, code, at} or null. Ask on the first look at a step as soon as
// there's code (tests or production) or results, then again only when a new
// run or build arrives AND the code changed since the last look. Never more
// than once every NEXT_STEPS_GAP seconds, across steps.
export function nextStepsDue(last, stepNumber, snapshot, nowSec, gap = NEXT_STEPS_GAP) {
  const run = runMark(snapshot);
  if (!run && !hasCode(snapshot)) return false;
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
    (step.required ? needed : practice).push({ id, text: step.text, detail, why: step.why, navigator: step.navigator, done });
  }
  if (extra?.text) (extra.needed ? needed : practice).push({ id: "extra", text: extra.text, done: null, extra: true });
  // Green and Refactor end only on a fresh run: after any change, running the
  // tests comes first, whether or not the coach (or the picker) chose it
  if ((phase === "green" || phase === "refactor") && now && changedSinceRun(now)) {
    const id = `${phase}.run_tests`;
    const at = needed.findIndex((s) => s.id === id);
    const run = at >= 0 ? needed.splice(at, 1)[0] : { id, text: BY_ID[id].text, detail: "", why: BY_ID[id].why, navigator: BY_ID[id].navigator };
    needed.unshift({ ...run, done: false });
  }
  const current = needed.findIndex((s) => s.done !== true);
  if (current >= 0) needed[current] = { ...needed[current], current: true };
  return { needed, practice };
}

// Does a coach answer carry guidance? A Done's Look is the verdict alone
// (steps [] and no extra), and so is any answer without a catalogue.
export const hasGuidance = (answer) => !!(answer?.steps?.length || answer?.extra);

// The step card: the coach's guidance when it has some, else the steps the
// rules pick for the code as it is (pickSteps): before the first Look, with
// the coach off, and after a held Done.
export function cardSteps(phase, answer, before, now, live, { novice = false } = {}) {
  if (hasGuidance(answer)) {
    const extra = answer.extra ? { text: answer.extra, needed: !!answer.extra_needed } : null;
    return groupSteps(phase, answer.steps, extra, before, now, live);
  }
  return groupSteps(phase, pickSteps(phase, before, now, live, { novice }), null, before, now, live);
}
