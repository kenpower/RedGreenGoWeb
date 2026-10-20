// The app's own TDD rule checks: pure, no AI. Each check compares the helper's
// snapshot at the last satisfied Done ("before") with the one now ("after").
// A snapshot is the helper's data: {tests: [{name, status, message}],
// build: {status, errors, time} | null, runTime, files: [{path, kind, content}]}.
//
// Test names come from the test source (TEST/TEST_F/TEST_P macros), not the
// last run, so a new test counts even when the build fails and it never ran.

const TEST_MACRO = /\bTEST(?:_F|_P)?\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g;

// Strips // and /* */ comments so commented-out tests don't count.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

export function testNames(snapshot) {
  const names = new Set();
  for (const file of snapshot?.files || []) {
    if (file.kind !== "test") continue;
    for (const m of stripComments(file.content || "").matchAll(TEST_MACRO)) names.add(`${m[1]}.${m[2]}`);
  }
  return names;
}

// The latest build failed and is newer than the latest test run, so the
// test results are out of date.
export function buildFailed(snapshot) {
  const build = snapshot?.build;
  return build?.status === "failed" && (!snapshot.runTime || build.time >= snapshot.runTime);
}

const results = (snapshot) => Object.fromEntries((snapshot?.tests || []).map((t) => [t.name, t.status]));

const testFiles = (snapshot) =>
  (snapshot?.files || [])
    .filter((f) => f.kind === "test")
    .map((f) => `${f.path}\n${f.content}`)
    .sort()
    .join("\n\0\n");

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

function allPass(after, findings) {
  if (buildFailed(after)) {
    findings.push({ rule: "build_fails", message: "The code doesn't build. Fix the build so all the tests can run." });
    return;
  }
  const failing = (after.tests || []).filter((t) => t.status === "failed").map((t) => t.name);
  if (failing.length)
    findings.push({ rule: "tests_fail", message: `Not all tests pass yet: ${failing.join(", ")}.` });
  // tests in the source that the last run didn't include
  const ran = results(after);
  const notRun = [...testNames(after)].filter((name) => !(name in ran));
  if (notRun.length)
    findings.push({ rule: "not_run", message: `Run the tests again: ${notRun.join(", ")} hasn't run yet.` });
}

// Red allows exactly one failing test. `failing` are the tests that fail
// (among those still in the source), counting a new test that doesn't
// compile yet.
function oneFailing(failing, findings) {
  if (failing.length <= 1) return;
  findings.push({
    rule: "one_failing",
    message:
      `${failing.length} tests fail: ${failing.join(", ")}. Only one test may fail in Red. ` +
      "Fix or comment out the others, then run the tests again.",
  });
}

function checkRed(before, after, findings) {
  if (!before) {
    // no baseline (the helper connected mid-game): only check that something is red
    const red = buildFailed(after) || (after.tests || []).some((t) => t.status === "failed");
    if (!red) findings.push({ rule: "nothing_fails", message: "No test fails. Write a test that fails first." });
    oneFailing(failingTests(after), findings);
    return;
  }
  const old = testNames(before);
  const added = [...testNames(after)].filter((name) => !old.has(name));
  if (added.length === 0) {
    findings.push({ rule: "no_new_test", message: "Write one new test before moving on." });
    return;
  }
  if (added.length > 1) {
    findings.push({ rule: "several_new_tests", message: `Only one new test at a time: ${added.join(", ")} are all new.` });
    return;
  }
  const name = added[0];
  if (buildFailed(after)) {
    // a compile error counts as the one red, unless an older test was
    // already failing in the last run
    oneFailing([...failingTests(after).filter((t) => t !== name), name], findings);
    return;
  }

  const now = results(after);
  if (!(name in now)) {
    findings.push({ rule: "not_run", message: `Run the tests: ${name} hasn't run yet.` });
    return;
  }
  if (now[name] !== "failed")
    findings.push({ rule: "new_test_passes", message: `${name} already passes. A new test should fail first.` });

  const was = results(before);
  const broken = Object.keys(was).filter((t) => t !== name && was[t] === "passed" && now[t] === "failed");
  if (broken.length)
    findings.push({ rule: "broke_tests", message: `Tests that passed before now fail: ${broken.join(", ")}.` });
  oneFailing(failingTests(after), findings);
}

function checkGreen(before, after, findings) {
  allPass(after, findings);
  if (before && testFiles(before) !== testFiles(after))
    findings.push({ rule: "tests_changed", message: "Make the test pass by changing the code, not the tests." });
}

function checkRefactor(before, after, findings) {
  allPass(after, findings);
  if (before && !sameSet(testNames(before), testNames(after)))
    findings.push({ rule: "tests_added_or_removed", message: "Refactoring shouldn't add or remove tests." });
}

const CHECKS = { red: checkRed, green: checkGreen, refactor: checkRefactor };

// Findings for finishing `phase`, [] when the rules are met. No helper data
// (after is null) means nothing to check. A null `before` (no baseline yet)
// skips the checks that compare with it.
export function checkRules(phase, before, after) {
  const check = CHECKS[phase];
  if (!check || !after) return [];
  const findings = [];
  check(before, after, findings);
  return findings;
}

// Results for the tests still in the source, so a deleted or renamed test's
// old result doesn't count. When no names can be read from the source (a
// macro we don't parse), all results count.
function currentResults(snapshot) {
  const names = testNames(snapshot);
  const tests = snapshot?.tests || [];
  return names.size ? tests.filter((t) => names.has(t.name)) : tests;
}

export function failingTests(snapshot) {
  return currentResults(snapshot)
    .filter((t) => t.status === "failed")
    .map((t) => t.name);
}

// Source files changed since the last commit; [] outside a git repo.
export function uncommittedFiles(snapshot) {
  const git = snapshot?.git;
  return git?.repo ? git.dirtySource || [] : [];
}

// No git repo (or a helper too old to say), so commits can't be checked.
export const noRepo = (snapshot) => !!snapshot && !snapshot.git?.repo;

// Where the code is before a Red step:
// "unknown"      tests in the source but no results for them yet
// "build_failed" the latest build failed
// "uncommitted"  source changed since the last commit (only with requireCommit)
// "one_failing"  exactly one test fails (maybe the pair's Red test already)
// "many_failing" more than one test fails
// "clean"        no tests, or all pass; also when there's no helper data
export function startState(snapshot, { requireCommit = true } = {}) {
  if (!snapshot) return "clean";
  if (buildFailed(snapshot)) return "build_failed";
  if (requireCommit && uncommittedFiles(snapshot).length) return "uncommitted";
  const hasTests = testNames(snapshot).size > 0 || (snapshot.tests || []).length > 0;
  if (!hasTests) return "clean";
  if (!currentResults(snapshot).length) return "unknown";
  const failing = failingTests(snapshot).length;
  return failing === 0 ? "clean" : failing === 1 ? "one_failing" : "many_failing";
}

// The snapshot with only results for tests still in the source, so a deleted,
// renamed or commented-out test's old result doesn't count. When no names can
// be read from the source (a macro we don't parse), all results stay.
export function currentSnapshot(snapshot) {
  if (!snapshot) return snapshot;
  const names = testNames(snapshot);
  if (!names.size) return snapshot;
  return { ...snapshot, tests: (snapshot.tests || []).filter((t) => names.has(t.name)) };
}

// A source file was saved after the latest build or test run (when the helper
// sends file times), so the results don't describe the code now.
export function changedSinceRun(snapshot) {
  const latest = buildFailed(snapshot) ? snapshot.build.time : snapshot?.runTime;
  if (!latest) return false;
  return (snapshot.files || []).some((f) => typeof f.mtime === "number" && f.mtime > latest);
}

// The last test run doesn't describe the code now, so it shouldn't be judged:
// a source file changed after the run, or, with a successful build, the run
// had tests no longer in the source or is missing tests that are. A failed
// build is fresh information in itself (its errors describe the code now).
export function staleResults(snapshot) {
  if (!snapshot || buildFailed(snapshot)) return false;
  if (snapshot.runTime && changedSinceRun(snapshot)) return true;
  const names = testNames(snapshot);
  if (!names.size) return false;
  const ran = new Set((snapshot.tests || []).map((t) => t.name));
  return [...ran].some((n) => !names.has(n)) || [...names].some((n) => !ran.has(n));
}

// Tests in the source that the last run didn't include.
const notRun = (snapshot) => {
  const ran = results(snapshot);
  return [...testNames(snapshot)].filter((name) => !(name in ran));
};

const list = (names) => names.join(", ");
const RUN_AGAIN = { text: "You've changed the code since the last run: run the tests", ok: null };
const BACK_TO_RED = "There's no failing test to make pass. Back to Red: write the test first.";

// What a step needs, checked live on every helper update. Each step has an
// entry condition, a goal and lines describing where the pair is, with the
// real test names: ok true = met, false = not yet, null = waiting (run the tests).
// `before` is the snapshot at the last satisfied Done (for Red, the baseline
// taken when the start check passed). Null when there's no helper data.
export function liveStatus(phase, before, now) {
  const check = LIVE[phase];
  if (!check || !now) return null;
  const status = { entryOk: true, entryProblem: null, focusTest: null, backToRed: null, lines: [], ...check(before, now) };
  status.goalMet = status.lines.length > 0 && status.lines.every((l) => l.ok === true);
  return status;
}

function liveRed(before, now) {
  if (!before) return { lines: [{ text: "Write one new test that fails", ok: false }] };
  const old = testNames(before);
  const added = [...testNames(now)].filter((name) => !old.has(name));
  if (added.length === 0) return { lines: [{ text: "No new test yet: write one test that fails", ok: false }] };
  if (added.length > 1)
    return { lines: [{ text: `${added.length} new tests (${list(added)}): keep one, comment out the others`, ok: false }] };

  const name = added[0];
  const lines = [];
  const ran = results(now);
  if (buildFailed(now)) {
    lines.push({ text: `New test ${name}: doesn't compile yet ✓ (that counts as failing)`, ok: true });
  } else if (changedSinceRun(now)) {
    lines.push(RUN_AGAIN);
  } else if (!(name in ran)) {
    lines.push({ text: `New test ${name} hasn't run yet: run the tests`, ok: null });
  } else if (ran[name] === "failed") {
    lines.push({ text: `New test ${name}: failing ✓`, ok: true });
  } else {
    lines.push({ text: `New test ${name} passes: make it fail for the right reason`, ok: false });
  }
  const was = results(before);
  const broken = failingTests(now).filter((t) => t !== name && was[t] === "passed");
  const others = failingTests(now).filter((t) => t !== name && !broken.includes(t));
  if (broken.length) lines.push({ text: `${list(broken)} passed before and now fail${broken.length > 1 ? "" : "s"}: fix that first`, ok: false });
  if (others.length) lines.push({ text: `Other tests fail too (${list(others)}): only one test may fail in Red`, ok: false });
  return { lines, focusTest: name };
}

function liveGreen(before, now) {
  // Entering Green needs a failing test (or the Red test's compile error). A
  // fully run, fully passing start means Red never had a failing test, even if
  // code was saved since: there's still nothing failing to make pass.
  const entryFails = before && (buildFailed(before) || failingTests(before).length > 0);
  const backToRed = before && !entryFails && !notRun(before).length ? BACK_TO_RED : null;
  // the Red test: the one failing, or with a compile error, the one that hasn't run
  const focus = (before && (failingTests(before)[0] || (buildFailed(before) && notRun(before)[0]))) || null;

  const lines = [];
  if (buildFailed(now)) {
    lines.push({ text: focus ? `Make ${focus} compile and pass` : "The code doesn't build yet: make it compile", ok: false });
  } else if (changedSinceRun(now)) {
    lines.push(RUN_AGAIN);
  } else {
    const unrun = notRun(now);
    if (unrun.length) lines.push({ text: `Run the tests: ${list(unrun)} hasn't run yet`, ok: null });
    const ran = results(now);
    if (focus && focus in ran) lines.push(ran[focus] === "passed" ? { text: `${focus} passes ✓`, ok: true } : { text: `Make ${focus} pass`, ok: false });
    const failing = failingTests(now).filter((t) => t !== focus);
    if (failing.length) lines.push({ text: `Not all tests pass: ${list(failing)}`, ok: false });
    else if (!unrun.length && !(focus && ran[focus] !== "passed")) lines.push({ text: "All tests green ✓", ok: true });
  }
  if (before && testFiles(before) !== testFiles(now))
    lines.push({ text: "Test files changed: Green only changes production code", ok: false });
  return { lines, focusTest: focus, backToRed, entryOk: !backToRed };
}

function liveRefactor(before, now) {
  const entryProblem =
    before && (buildFailed(before) || failingTests(before).length)
      ? { kind: "failing", message: "Tests fail as Refactor starts: get back to all green first." }
      : null;
  const lines = [];
  if (buildFailed(now)) {
    lines.push({ text: "The code doesn't build: undo the last change", ok: false });
  } else if (changedSinceRun(now)) {
    lines.push(RUN_AGAIN);
  } else {
    const unrun = notRun(now);
    if (unrun.length) lines.push({ text: `Run the tests: ${list(unrun)} hasn't run yet`, ok: null });
    const failing = failingTests(now);
    if (failing.length)
      lines.push({ text: `${list(failing)} now fail${failing.length > 1 ? "" : "s"}: undo the last change`, ok: false });
    else if (!unrun.length) lines.push({ text: "All tests green ✓", ok: true });
  }
  if (before && !sameSet(testNames(before), testNames(now)))
    lines.push({ text: "Tests added or removed: Refactor keeps the tests the same", ok: false });
  return { lines, entryProblem, entryOk: !entryProblem };
}

const LIVE = { red: liveRed, green: liveGreen, refactor: liveRefactor };

// Keeps only what the rules and the coach need from the helper's data.
export function snapshotOf(data) {
  if (!data) return null;
  const { tests = [], build = null, runTime = null, files = [], git = null } = data;
  return { tests, build, runTime, files, git };
}
