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

function checkRed(before, after, findings) {
  if (!before) {
    // no baseline (the helper connected mid-game): only check that something is red
    const red = buildFailed(after) || (after.tests || []).some((t) => t.status === "failed");
    if (!red) findings.push({ rule: "nothing_fails", message: "No test fails. Write a test that fails first." });
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
  if (buildFailed(after)) return; // a compile error counts as red

  const now = results(after);
  const name = added[0];
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

// Keeps only what the rules and the coach need from the helper's data.
export function snapshotOf(data) {
  if (!data) return null;
  const { tests = [], build = null, runTime = null, files = [] } = data;
  return { tests, build, runTime, files };
}
