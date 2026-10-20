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

// The text of the { } block that starts after `from` (braces in strings are rare
// enough in test code to ignore). To the end when it never closes.
function blockAt(src, from) {
  const open = src.indexOf("{", from);
  if (open < 0) return src.slice(from);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(from, i + 1);
  }
  return src.slice(from);
}

// Each test's source, from its TEST macro to the end of its body, comments
// stripped and whitespace squashed, so an edit to a test shows as a change.
export function testBodies(snapshot) {
  const bodies = {};
  for (const file of snapshot?.files || []) {
    if (file.kind !== "test") continue;
    const src = stripComments(file.content || "");
    for (const m of src.matchAll(TEST_MACRO)) bodies[`${m[1]}.${m[2]}`] = blockAt(src, m.index).replace(/\s+/g, " ").trim();
  }
  return bodies;
}

// Visual Studio's GoogleTest template test: a project with only this has no real tests yet.
export const isPlaceholderTest = (name) => name === "TestCaseName.TestName";

const VAGUE_TEST =
  /^(?:test_?\d*|testname|mytest\d*|newtest\d*|foo|bar|baz|works|it|check\d*|example\d*|sample\d*|temp|tmp|untitled\d*|t\d*)$/i;

// A name that doesn't say what the test checks: the template, Test1, MyTest,
// Foo, Works, or anything under 3 characters.
export function isVagueTestName(name) {
  const test = name.split(".").pop();
  return isPlaceholderTest(name) || test.length < 3 || VAGUE_TEST.test(test);
}

const GTEST_WORDS = /\b(?:EXPECT|ASSERT)_\w+\b|\b(?:true|false|nullptr|NULL)\b/g;
const LITERALS = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d[\w.]*\b/g;

// Whether a test body uses anything but gtest macros and literals, i.e. calls
// some of the pair's code. EXPECT_TRUE(false) or EXPECT_EQ(1, 1) doesn't.
export function callsCode(body) {
  const inner = body.slice(body.indexOf("{") + 1); // skip the TEST(Suite, Name) header
  return /[A-Za-z_]\w*/.test(inner.replace(LITERALS, " ").replace(GTEST_WORDS, " "));
}

const FUNC_DEF = /(?:[\w>*&]\s+|[*&])(\w+)\s*\([^;{}()]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?\{/g;
const NOT_FUNCS = new Set(["if", "for", "while", "switch", "catch", "return", "else", "do", "sizeof", "main"]);

// Functions defined anywhere in the source (the test files too, outside the
// TEST blocks) that no test mentions: code written before its test.
export function untestedFunctions(snapshot) {
  const defined = new Set();
  let testText = "";
  for (const file of snapshot?.files || []) {
    let src = stripComments(file.content || "");
    if (file.kind === "test") {
      const blocks = [...src.matchAll(TEST_MACRO)].map((m) => blockAt(src, m.index));
      testText += blocks.join("\n");
      for (const block of blocks) src = src.replace(block, " ");
    }
    for (const m of src.matchAll(FUNC_DEF)) if (!NOT_FUNCS.has(m[1])) defined.add(m[1]);
  }
  return [...defined].filter((name) => !new RegExp(`\\b${name}\\b`).test(testText));
}

// The latest build failed and is newer than the latest test run, so the
// test results are out of date.
export function buildFailed(snapshot) {
  const build = snapshot?.build;
  return build?.status === "failed" && (!snapshot.runTime || build.time >= snapshot.runTime);
}

const results = (snapshot) => Object.fromEntries((snapshot?.tests || []).map((t) => [t.name, t.status]));

// How the tests themselves changed between two snapshots: the TEST(...) blocks
// compared by name and body, comments and whitespace ignored. Edits outside
// them (an #include for the new header, using lines, helper declarations,
// comments) aren't changes to the tests.
export function testChanges(before, now) {
  const was = testBodies(before);
  const is = testBodies(now);
  return {
    added: Object.keys(is).filter((name) => !(name in was)),
    removed: Object.keys(was).filter((name) => !(name in is)),
    changed: Object.keys(is).filter((name) => name in was && was[name] !== is[name]),
  };
}

const anyChange = (c) => c.added.length + c.removed.length + c.changed.length > 0;

// What to tell the pair about tests changed in Green (where none may change)
// or Refactor (where the same tests must stay; editing a test's body is
// allowed there, as long as it still checks the same thing).
export function testChangeMessage(phase, changes) {
  const { added, removed, changed } = changes;
  if (phase === "green") {
    if (changed.length) return `You changed the test ${list(changed)}: Green only changes production code`;
    if (added.length) return `You added a test (${list(added)}): new tests belong in the next Red`;
    if (removed.length) return `You removed the test ${list(removed)}: put it back`;
  } else {
    if (added.length) return `You added a test (${list(added)}): Refactor keeps the same tests`;
    if (removed.length) return `You removed the test ${list(removed)}: Refactor keeps the same tests`;
  }
  return "";
}

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

// Which test is this Red's test: a new test name, or an existing test that
// passed when Red began and whose body has changed since (e.g. VS's template
// test edited to fail). When the baseline's only tests are templates, there
// are no real tests yet, so a template test that changed or fails counts as new.
// Returns {name, how: "new" | "edited"} or {problem: {rule, message}}.
export function pickRedTest(before, now) {
  const oldAll = testNames(before);
  const templatesOnly = oldAll.size > 0 && [...oldAll].every(isPlaceholderTest);
  const old = templatesOnly ? new Set() : oldAll;
  const was = results(before);
  const ran = results(now);
  const oldBodies = testBodies(before);
  const newBodies = testBodies(now);
  const changed = (name) => oldBodies[name] !== newBodies[name];
  const names = [...testNames(now)];

  const added = names.filter(
    (n) => !old.has(n) && !(templatesOnly && oldAll.has(n) && !changed(n) && ran[n] !== "failed")
  );
  if (added.length > 1)
    return {
      names: added,
      problem: { rule: "several_new_tests", message: `Only one new test at a time: ${added.join(", ")} are all new.` },
    };
  if (added.length === 1) return { name: added[0], how: "new" };

  const edited = names.filter((n) => old.has(n) && was[n] === "passed" && changed(n));
  const editedRed = edited.filter((n) => buildFailed(now) || ran[n] === "failed");
  if (editedRed.length > 1)
    return {
      names: editedRed,
      problem: { rule: "several_new_tests", message: `Only one test at a time: ${editedRed.join(", ")} all changed and fail.` },
    };
  if (editedRed.length === 1) return { name: editedRed[0], how: "edited" };
  if (edited.length) return { name: edited[0], how: "edited" }; // changed, still passing
  return { problem: { rule: "no_new_test", message: "Write one new test before moving on." } };
}

// This Red's test passed straight away: a new (or changed) test that calls the
// pair's code, ran with fresh results and a good build, and passes. Either the
// code already does it, or the test doesn't check what they think. Its name, or null.
export function passedFirstTest(before, now) {
  if (!before || !now || buildFailed(now) || changedSinceRun(now)) return null;
  const pick = pickRedTest(before, now);
  if (pick.problem) return null;
  if (!callsCode(testBodies(now)[pick.name] || "")) return null;
  return results(now)[pick.name] === "passed" ? pick.name : null;
}

// The function a test body calls first (not a gtest macro), e.g. "fizzBuzz", or null.
export function calledFunction(body) {
  const inner = (body || "").slice((body || "").indexOf("{") + 1).replace(LITERALS, " ");
  for (const m of inner.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) if (!/^(?:EXPECT|ASSERT)_/.test(m[1])) return m[1];
  return null;
}

const noCodeMessage = (name) =>
  `${name} fails, but it doesn't call any of your code. Make it call the function you're about to write.`;

function checkRed(before, after, findings) {
  if (!before) {
    // no baseline (the helper connected mid-game): only check that something is red
    const red = buildFailed(after) || (after.tests || []).some((t) => t.status === "failed");
    if (!red) findings.push({ rule: "nothing_fails", message: "No test fails. Write a test that fails first." });
    oneFailing(failingTests(after), findings);
    return;
  }
  const pick = pickRedTest(before, after);
  if (pick.problem) {
    findings.push(pick.problem);
    return;
  }
  const name = pick.name;
  if (!callsCode(testBodies(after)[name] || "")) {
    findings.push({ rule: "no_code_called", message: noCodeMessage(name) });
    return;
  }
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
    findings.push({
      rule: "new_test_passes",
      message:
        pick.how === "edited"
          ? `${name} changed but still passes. Red's test should fail first.`
          : `${name} already passes. A new test should fail first.`,
    });

  const was = results(before);
  const broken = Object.keys(was).filter((t) => t !== name && was[t] === "passed" && now[t] === "failed");
  if (broken.length)
    findings.push({ rule: "broke_tests", message: `Tests that passed before now fail: ${broken.join(", ")}.` });
  oneFailing(failingTests(after), findings);
}

function checkGreen(before, after, findings) {
  allPass(after, findings);
  const changes = before && testChanges(before, after);
  if (changes && anyChange(changes))
    findings.push({ rule: "tests_changed", message: testChangeMessage("green", changes) + "." });
}

function checkRefactor(before, after, findings) {
  allPass(after, findings);
  if (before && !sameSet(testNames(before), testNames(after)))
    findings.push({ rule: "tests_added_or_removed", message: testChangeMessage("refactor", testChanges(before, after)) + "." });
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
  // only VS's template test: no real tests yet, whatever its result (the
  // pair may already have edited it into their first Red test)
  const names = [...testNames(snapshot)];
  if (names.length && names.every(isPlaceholderTest)) return "clean";
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
  status.advice = phase === "green" ? [] : nameAdvice(now, status.focusTest);
  return status;
}

// Advice only, never a hold: tests whose names don't say what they check
// (at most two, and not the Red test, whose live line already says so).
export function nameAdvice(snapshot, except = null) {
  return [...testNames(snapshot)]
    .filter((name) => name !== except && isVagueTestName(name))
    .slice(0, 2)
    .map((name) => `Rename ${name} to say what it checks.`);
}

// Advice only: functions written before any test calls them.
export function codeFirstAdvice(snapshot) {
  return untestedFunctions(snapshot)
    .slice(0, 2)
    .map((name) => `${name} was written before any test. In TDD the test comes first; consider deleting it and letting the tests drive it.`);
}

function liveRed(before, now) {
  if (!before) return { lines: [{ text: "Write one new test that fails", ok: false }] };
  const pick = pickRedTest(before, now);
  if (pick.problem?.rule === "no_new_test") {
    // say exactly why: a failing test that was already failing, or none failing
    const failing = failingTests(now);
    const text = failing.length
      ? `${failing[0]} fails, but it hasn't changed since this Red began: change it, or write a new test`
      : buildFailed(now)
        ? "The build fails, but no test is new or changed since this Red began"
        : "No test is failing yet: write one new test (or change one) so that it fails";
    return { lines: [{ text, ok: false }] };
  }
  if (pick.problem)
    return { lines: [{ text: `${pick.names.length} new tests (${list(pick.names)}): keep one, comment out the others`, ok: false }] };

  const name = pick.name;
  // the template's name says nothing: ask for a better one as they go
  const rename = isVagueTestName(name) ? " (rename it to say what it checks)" : "";
  const label = pick.how === "edited" ? name : `New test ${name}`;
  const lines = [];
  const ran = results(now);
  if (buildFailed(now)) {
    lines.push({ text: `${label}: doesn't compile yet ✓ (that counts as failing)${rename}`, ok: true });
  } else if (changedSinceRun(now)) {
    lines.push(RUN_AGAIN);
  } else if (!(name in ran)) {
    lines.push({ text: `${label} hasn't run yet: run the tests`, ok: null });
  } else if (ran[name] === "failed") {
    lines.push({ text: pick.how === "edited" ? `${name} now fails ✓${rename}` : `New test ${name}: failing ✓${rename}`, ok: true });
  } else {
    lines.push({ text: `${label} passes: it needs to fail first`, ok: false });
  }
  if (!callsCode(testBodies(now)[name] || "")) lines.push({ text: noCodeMessage(name), ok: false });
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
  const changes = before && testChanges(before, now);
  if (changes && anyChange(changes)) lines.push({ text: testChangeMessage("green", changes), ok: false, testsChanged: true });
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
    lines.push({ text: testChangeMessage("refactor", testChanges(before, now)), ok: false, testsChanged: true });
  return { lines, entryProblem, entryOk: !entryProblem };
}

const LIVE = { red: liveRed, green: liveGreen, refactor: liveRefactor };

// Keeps only what the rules and the coach need from the helper's data.
export function snapshotOf(data) {
  if (!data) return null;
  const { tests = [], build = null, runTime = null, files = [], git = null } = data;
  return { tests, build, runTime, files, git };
}
