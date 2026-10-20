import {
  checkRules,
  liveStatus,
  changedSinceRun,
  testNames,
  buildFailed,
  snapshotOf,
  startState,
  failingTests,
  uncommittedFiles,
  noRepo,
} from "../src/rules.js";

// Builds a helper snapshot: test source from the names, results as given.
const testSource = (names) =>
  '#include "pch.h"\n' + names.map((n) => n.split(".")).map(([s, t]) => `TEST(${s}, ${t}) {\n  EXPECT_EQ(1, 1);\n}\n`).join("\n");

function snap({ source = [], results = {}, build = null, runTime = 10, code = "int f() { return 1; }", testFile, git } = {}) {
  return {
    tests: Object.entries(results).map(([name, status]) => ({ name, status, message: "" })),
    build,
    runTime,
    git,
    files: [
      { path: "test.cpp", kind: "test", content: testFile ?? testSource(source) },
      { path: "f.cpp", kind: "production", content: code },
    ],
  };
}

const rules = (findings) => findings.map((f) => f.rule);
const failedBuild = (time = 20) => ({ status: "failed", errors: ["C3861 'f': identifier not found"], time });

describe("testNames", () => {
  test("reads TEST, TEST_F and TEST_P names from test files only", () => {
    const s = snap({
      testFile: "TEST(A, one) {}\nTEST_F(Fixture, two) {}\nTEST_P( P , three ) {}",
    });
    s.files.push({ path: "other.cpp", kind: "production", content: "TEST(Not, counted) {}" });
    expect([...testNames(s)]).toEqual(["A.one", "Fixture.two", "P.three"]);
  });

  test("ignores commented-out tests", () => {
    const s = snap({ testFile: "// TEST(A, line) {}\n/* TEST(A, block) {}\n*/\nTEST(A, real) {}" });
    expect([...testNames(s)]).toEqual(["A.real"]);
  });

  test("handles a missing snapshot", () => {
    expect(testNames(null).size).toBe(0);
  });
});

describe("buildFailed", () => {
  test("a failed build newer than the last run", () => {
    expect(buildFailed(snap({ build: failedBuild(20), runTime: 10 }))).toBe(true);
  });
  test("a failed build older than the last run doesn't count", () => {
    expect(buildFailed(snap({ build: failedBuild(5), runTime: 10 }))).toBe(false);
  });
  test("a failed build with no run yet", () => {
    expect(buildFailed(snap({ build: failedBuild(5), runTime: null }))).toBe(true);
  });
  test("a good build", () => {
    expect(buildFailed(snap({ build: { status: "succeeded", errors: [], time: 20 } }))).toBe(false);
  });
});

describe("no helper data", () => {
  test("no findings for any phase", () => {
    for (const phase of ["red", "green", "refactor"]) expect(checkRules(phase, snap(), null)).toEqual([]);
  });
  test("no findings for swap or finish", () => {
    expect(checkRules("swap", snap(), snap())).toEqual([]);
    expect(checkRules("finish", snap(), snap())).toEqual([]);
  });
});

describe("red", () => {
  const before = snap({ source: ["F.a"], results: { "F.a": "passed" } });

  test("one new failing test is fine", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "failed" } });
    expect(checkRules("red", before, after)).toEqual([]);
  });

  test("a compile error counts as red, even though the new test never ran", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed" }, build: failedBuild() });
    expect(checkRules("red", before, after)).toEqual([]);
  });

  test("no new test", () => {
    const after = snap({ source: ["F.a"], results: { "F.a": "failed" } });
    expect(rules(checkRules("red", before, after))).toEqual(["no_new_test"]);
  });

  test("more than one new test", () => {
    const after = snap({ source: ["F.a", "F.b", "F.c"], results: { "F.a": "passed", "F.b": "failed", "F.c": "failed" } });
    const findings = checkRules("red", before, after);
    expect(rules(findings)).toEqual(["several_new_tests"]);
    expect(findings[0].message).toContain("F.b, F.c");
  });

  test("the new test passes", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "passed" } });
    expect(rules(checkRules("red", before, after))).toEqual(["new_test_passes"]);
  });

  test("the new test hasn't been run", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed" } });
    expect(rules(checkRules("red", before, after))).toEqual(["not_run"]);
  });

  test("a test that passed before now fails", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "failed", "F.b": "failed" } });
    const findings = checkRules("red", before, after);
    expect(rules(findings)).toEqual(["broke_tests", "one_failing"]);
    expect(findings[0].message).toContain("F.a");
  });

  describe("only one failing test", () => {
    const oldFailing = snap({ source: ["F.a", "F.old"], results: { "F.a": "passed", "F.old": "failed" } });

    test("two failing tests", () => {
      const after = snap({
        source: ["F.a", "F.b", "F.c"],
        results: { "F.a": "failed", "F.b": "passed", "F.c": "failed" },
      });
      const findings = checkRules("red", null, after);
      expect(rules(findings)).toEqual(["one_failing"]);
      expect(findings[0].message).toBe(
        "2 tests fail: F.a, F.c. Only one test may fail in Red. Fix or comment out the others, then run the tests again."
      );
    });

    test("an old failing test plus the new one", () => {
      const after = snap({
        source: ["F.a", "F.old", "F.new"],
        results: { "F.a": "passed", "F.old": "failed", "F.new": "failed" },
      });
      const findings = checkRules("red", oldFailing, after);
      expect(rules(findings)).toEqual(["one_failing"]);
      expect(findings[0].message).toContain("2 tests fail: F.old, F.new.");
    });

    test("a compile-error Red with an old failure doesn't count as the one red", () => {
      const after = snap({
        source: ["F.a", "F.old", "F.new"],
        results: { "F.a": "passed", "F.old": "failed" },
        build: failedBuild(),
      });
      const findings = checkRules("red", oldFailing, after);
      expect(rules(findings)).toEqual(["one_failing"]);
      expect(findings[0].message).toContain("2 tests fail: F.old, F.new.");
    });

    test("a compile-error Red with no old failure is fine", () => {
      const after = snap({ source: ["F.a", "F.new"], results: { "F.a": "passed" }, build: failedBuild() });
      expect(checkRules("red", before, after)).toEqual([]);
    });

    test("a commented-out failing test is ignored", () => {
      const after = snap({
        testFile: testSource(["F.a", "F.new"]) + "\n// TEST(F, old) {}",
        results: { "F.a": "passed", "F.old": "failed", "F.new": "failed" },
      });
      expect(checkRules("red", oldFailing, after)).toEqual([]);
    });

    test("with no baseline, a compile error alone is fine", () => {
      expect(checkRules("red", null, snap({ source: ["F.a"], build: failedBuild() }))).toEqual([]);
    });
  });

  test("a renamed test counts as one new test", () => {
    const after = snap({ source: ["F.renamed"], results: { "F.renamed": "failed" } });
    expect(checkRules("red", before, after)).toEqual([]);
  });

  test("the first test of the game, with no tests before", () => {
    const empty = snap({ testFile: '#include "pch.h"\n' });
    const after = snap({ source: ["F.a"], build: failedBuild() });
    expect(checkRules("red", empty, after)).toEqual([]);
  });

  describe("with no baseline", () => {
    test("something failing is enough", () => {
      const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "failed" } });
      expect(checkRules("red", null, after)).toEqual([]);
    });
    test("a failed build is enough", () => {
      expect(checkRules("red", null, snap({ source: ["F.a"], build: failedBuild() }))).toEqual([]);
    });
    test("nothing failing", () => {
      const after = snap({ source: ["F.a"], results: { "F.a": "passed" } });
      expect(rules(checkRules("red", null, after))).toEqual(["nothing_fails"]);
    });
  });
});

describe("green", () => {
  const before = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "failed" } });

  test("all tests pass and the tests are unchanged", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "passed" }, code: "changed" });
    expect(checkRules("green", before, after)).toEqual([]);
  });

  test("a test still fails", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "failed" } });
    const findings = checkRules("green", before, after);
    expect(rules(findings)).toEqual(["tests_fail"]);
    expect(findings[0].message).toContain("F.b");
  });

  test("the build fails", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "passed" }, build: failedBuild() });
    expect(rules(checkRules("green", before, after))).toEqual(["build_fails"]);
  });

  test("a red test that never ran because the build failed must now run", () => {
    const redBefore = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed" }, build: failedBuild() });
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed" }, runTime: 30 });
    expect(rules(checkRules("green", redBefore, after))).toEqual(["not_run"]);
  });

  test("the tests were changed", () => {
    const after = snap({
      testFile: testSource(["F.a", "F.b"]) + "\n// loosened",
      results: { "F.a": "passed", "F.b": "passed" },
    });
    expect(rules(checkRules("green", before, after))).toEqual(["tests_changed"]);
  });

  test("several problems at once", () => {
    const after = snap({ source: ["F.a"], results: { "F.a": "failed" } });
    expect(rules(checkRules("green", before, after))).toEqual(["tests_fail", "tests_changed"]);
  });

  test("with no baseline only the results are checked", () => {
    const after = snap({ source: ["F.a"], results: { "F.a": "passed" } });
    expect(checkRules("green", null, after)).toEqual([]);
  });
});

describe("refactor", () => {
  const before = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "passed" } });

  test("tests still pass, code and test bodies may change", () => {
    const after = snap({
      testFile: testSource(["F.a", "F.b"]).replace(/EXPECT_EQ\(1, 1\)/, "EXPECT_TRUE(true)"),
      results: { "F.a": "passed", "F.b": "passed" },
      code: "int f() { return ONE; }",
    });
    expect(checkRules("refactor", before, after)).toEqual([]);
  });

  test("a test now fails", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "failed" } });
    expect(rules(checkRules("refactor", before, after))).toEqual(["tests_fail"]);
  });

  test("a test was added", () => {
    const after = snap({ source: ["F.a", "F.b", "F.c"], results: { "F.a": "passed", "F.b": "passed", "F.c": "passed" } });
    expect(rules(checkRules("refactor", before, after))).toEqual(["tests_added_or_removed"]);
  });

  test("a test was removed", () => {
    const after = snap({ source: ["F.a"], results: { "F.a": "passed", "F.b": "passed" } });
    expect(rules(checkRules("refactor", before, after))).toEqual(["tests_added_or_removed"]);
  });

  test("the build fails", () => {
    const after = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "passed" }, build: failedBuild() });
    expect(rules(checkRules("refactor", before, after))).toEqual(["build_fails"]);
  });
});

describe("startState", () => {
  test("no helper data counts as clean", () => {
    expect(startState(null)).toBe("clean");
  });

  test("no tests at all", () => {
    expect(startState(snap({ testFile: '#include "pch.h"\n' }))).toBe("clean");
  });

  test("all tests pass", () => {
    expect(startState(snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "passed" } }))).toBe("clean");
  });

  test("tests in the source but no results yet", () => {
    expect(startState(snap({ source: ["F.a"] }))).toBe("unknown");
  });

  test("only results for tests that no longer exist", () => {
    expect(startState(snap({ source: ["F.renamed"], results: { "F.old": "failed" } }))).toBe("unknown");
  });

  test("the build fails", () => {
    expect(startState(snap({ source: ["F.a"], results: { "F.a": "passed" }, build: failedBuild() }))).toBe("build_failed");
  });

  test("a build failure older than the last run doesn't count", () => {
    const s = snap({ source: ["F.a"], results: { "F.a": "passed" }, build: failedBuild(5), runTime: 10 });
    expect(startState(s)).toBe("clean");
  });

  test("exactly one failing test", () => {
    const s = snap({ source: ["F.a", "F.b"], results: { "F.a": "passed", "F.b": "failed" } });
    expect(startState(s)).toBe("one_failing");
    expect(failingTests(s)).toEqual(["F.b"]);
  });

  test("several failing tests", () => {
    const s = snap({ source: ["F.a", "F.b", "F.c"], results: { "F.a": "failed", "F.b": "failed", "F.c": "passed" } });
    expect(startState(s)).toBe("many_failing");
    expect(failingTests(s)).toEqual(["F.a", "F.b"]);
  });

  test("a failing result for a test that was commented out doesn't count", () => {
    const s = snap({
      testFile: testSource(["F.a"]) + "\n// TEST(F, b) {}",
      results: { "F.a": "passed", "F.b": "failed" },
    });
    expect(startState(s)).toBe("clean");
  });

  test("results count when no test names can be read from the source", () => {
    const s = snap({ testFile: "TYPED_TEST(F, a) {}", results: { "F/0.a": "failed" } });
    expect(startState(s)).toBe("one_failing");
  });

  describe("uncommitted work", () => {
    const repo = (dirtySource = []) => ({
      repo: true,
      branch: "main",
      head: "abc123",
      headTime: 1,
      headMessage: "Green: 1",
      dirty: dirtySource.length > 0,
      dirtySource,
    });
    const passing = { source: ["F.a"], results: { "F.a": "passed" } };

    test("changed source files hold the Red", () => {
      const s = snap({ ...passing, git: repo(["src/f.cpp", "test/test.cpp"]) });
      expect(startState(s)).toBe("uncommitted");
      expect(uncommittedFiles(s)).toEqual(["src/f.cpp", "test/test.cpp"]);
    });

    test("everything committed", () => {
      expect(startState(snap({ ...passing, git: repo() }))).toBe("clean");
    });

    test("comes after a failed build", () => {
      const s = snap({ ...passing, build: failedBuild(), git: repo(["f.cpp"]) });
      expect(startState(s)).toBe("build_failed");
    });

    test("comes before failing tests", () => {
      const s = snap({ source: ["F.a", "F.b"], results: { "F.a": "failed", "F.b": "failed" }, git: repo(["f.cpp"]) });
      expect(startState(s)).toBe("uncommitted");
    });

    test("comes before unknown results", () => {
      expect(startState(snap({ source: ["F.a"], git: repo(["f.cpp"]) }))).toBe("uncommitted");
    });

    test("not required: falls through to the other checks", () => {
      const options = { requireCommit: false };
      expect(startState(snap({ ...passing, git: repo(["f.cpp"]) }), options)).toBe("clean");
      const failing = snap({ source: ["F.a"], results: { "F.a": "failed" }, git: repo(["f.cpp"]) });
      expect(startState(failing, options)).toBe("one_failing");
    });

    test("not a git repo: no hold, and noRepo says so", () => {
      const s = snap({ ...passing, git: { repo: false, dirtySource: ["f.cpp"] } });
      expect(startState(s)).toBe("clean");
      expect(uncommittedFiles(s)).toEqual([]);
      expect(noRepo(s)).toBe(true);
    });

    test("no git data from an older helper: no hold, and noRepo says so", () => {
      const s = snap(passing);
      expect(startState(s)).toBe("clean");
      expect(noRepo(s)).toBe(true);
    });

    test("noRepo is false in a repo, and without a helper", () => {
      expect(noRepo(snap({ ...passing, git: repo() }))).toBe(false);
      expect(noRepo(null)).toBe(false);
    });

    test("a repo without a dirtySource list counts as committed", () => {
      expect(startState(snap({ ...passing, git: { repo: true } }))).toBe("clean");
    });
  });
});

// The user's real game (2026-10-20): only Visual Studio's placeholder test,
// passing, no git, production code added during Red. The rules do flag it;
// Red advanced because Game acted on a coach "advance" (or amber-only with
// the rules off) without holding on the finding.
describe("placeholder-only Red", () => {
  const placeholder = { source: ["TestCaseName.TestName"], results: { "TestCaseName.TestName": "passed" }, git: { repo: false } };

  test("the start check calls it clean, so it becomes the baseline", () => {
    expect(startState(snap(placeholder), { requireCommit: true })).toEqual("clean");
  });

  test("Red's Done then finds no new test", () => {
    const before = snap(placeholder);
    const after = snap({ ...placeholder, code: "std::string fizzBuzz(int n) { return \"1\"; }" });
    expect(rules(checkRules("red", before, after))).toEqual(["no_new_test"]);
  });

  test("without a baseline, it still finds that nothing fails", () => {
    expect(rules(checkRules("red", null, snap(placeholder)))).toEqual(["nothing_fails"]);
  });
});

describe("liveStatus", () => {
  const lines = (status) => status.lines.map((l) => [l.text, l.ok]);
  const base = snap({ source: ["A.one"], results: { "A.one": "passed" } });

  test("no helper data or a swap step: nothing to show", () => {
    expect(liveStatus("red", base, null)).toBeNull();
    expect(liveStatus("swap", base, base)).toBeNull();
  });

  describe("red", () => {
    test("no new test yet", () => {
      const s = liveStatus("red", base, base);
      expect(lines(s)).toEqual([["No new test yet: write one test that fails", false]]);
      expect(s.goalMet).toBe(false);
    });

    test("only production code added (the user's placeholder game): still no new test", () => {
      const now = snap({ source: ["A.one"], results: { "A.one": "passed" }, code: "int g() { return 2; }" });
      expect(liveStatus("red", base, now).goalMet).toBe(false);
    });

    test("one new failing test meets the goal, and is the focus", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed", "A.two": "failed" } });
      const s = liveStatus("red", base, now);
      expect(lines(s)).toEqual([["New test A.two: failing ✓", true]]);
      expect(s.goalMet).toBe(true);
      expect(s.focusTest).toEqual("A.two");
    });

    test("a compile error from the one new test counts as failing", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed" }, build: failedBuild() });
      const s = liveStatus("red", base, now);
      expect(lines(s)).toEqual([["New test A.two: doesn't compile yet ✓ (that counts as failing)", true]]);
      expect(s.goalMet).toBe(true);
    });

    test("a new test that hasn't run yet is waiting", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed" } });
      const s = liveStatus("red", base, now);
      expect(lines(s)).toEqual([["New test A.two hasn't run yet: run the tests", null]]);
      expect(s.goalMet).toBe(false);
    });

    test("a new test that passes", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed", "A.two": "passed" } });
      expect(lines(liveStatus("red", base, now))).toEqual([["New test A.two passes: make it fail for the right reason", false]]);
    });

    test("two new tests", () => {
      const now = snap({ source: ["A.one", "A.two", "A.three"], results: {} });
      expect(lines(liveStatus("red", base, now))).toEqual([
        ["2 new tests (A.two, A.three): keep one, comment out the others", false],
      ]);
    });

    test("an old test broken on the way", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "failed", "A.two": "failed" } });
      const s = liveStatus("red", base, now);
      expect(lines(s)).toEqual([
        ["New test A.two: failing ✓", true],
        ["A.one passed before and now fails: fix that first", false],
      ]);
      expect(s.goalMet).toBe(false);
    });

    test("code saved after the last run: run the tests again", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed", "A.two": "failed" } });
      now.files[0].mtime = 50; // runTime is 10
      expect(lines(liveStatus("red", base, now))).toEqual([["You've changed the code since the last run: run the tests", null]]);
    });

    test("without a baseline: write a failing test", () => {
      expect(liveStatus("red", null, base).goalMet).toBe(false);
    });
  });

  describe("green", () => {
    const redEnd = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed", "A.two": "failed" } });

    test("entered with the Red test failing: focus on it, goal not met yet", () => {
      const s = liveStatus("green", redEnd, redEnd);
      expect(s.focusTest).toEqual("A.two");
      expect(s.backToRed).toBeNull();
      expect(lines(s)).toEqual([["Make A.two pass", false]]);
    });

    test("all passing with the tests unchanged meets the goal", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed", "A.two": "passed" }, code: "int f() { return 2; }" });
      const s = liveStatus("green", redEnd, now);
      expect(lines(s)).toEqual([["A.two passes ✓", true], ["All tests green ✓", true]]);
      expect(s.goalMet).toBe(true);
    });

    test("the user's case: Green entered with only a passing placeholder sends the pair back to Red", () => {
      const placeholder = snap({ source: ["TestCaseName.TestName"], results: { "TestCaseName.TestName": "passed" } });
      const s = liveStatus("green", placeholder, placeholder);
      expect(s.backToRed).toEqual("There's no failing test to make pass. Back to Red: write the test first.");
      expect(s.entryOk).toBe(false);
    });

    test("...even when code was saved after the last run", () => {
      const placeholder = snap({ source: ["TestCaseName.TestName"], results: { "TestCaseName.TestName": "passed" } });
      placeholder.files[1].mtime = 50;
      expect(liveStatus("green", placeholder, placeholder).backToRed).not.toBeNull();
    });

    test("entered with the Red test's compile error: no back to Red, and that test is the focus", () => {
      const compileRed = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed" }, build: failedBuild() });
      const s = liveStatus("green", compileRed, compileRed);
      expect(s.backToRed).toBeNull();
      expect(s.focusTest).toEqual("A.two");
      expect(lines(s)).toEqual([["Make A.two compile and pass", false]]);
    });

    test("changing the tests in Green", () => {
      const now = snap({
        source: ["A.one", "A.two"],
        results: { "A.one": "passed", "A.two": "passed" },
        testFile: testSource(["A.one", "A.two"]) + "// edited",
      });
      const s = liveStatus("green", redEnd, now);
      expect(lines(s)).toContainEqual(["Test files changed: Green only changes production code", false]);
      expect(s.goalMet).toBe(false);
    });

    test("another test fails", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "failed", "A.two": "passed" } });
      expect(lines(liveStatus("green", redEnd, now))).toEqual([["A.two passes ✓", true], ["Not all tests pass: A.one", false]]);
    });
  });

  describe("refactor", () => {
    const green = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed", "A.two": "passed" } });

    test("all green with the same tests meets the goal", () => {
      const s = liveStatus("refactor", green, green);
      expect(lines(s)).toEqual([["All tests green ✓", true]]);
      expect(s.goalMet).toBe(true);
      expect(s.entryProblem).toBeNull();
    });

    test("a test broken by the refactor", () => {
      const now = snap({ source: ["A.one", "A.two"], results: { "A.one": "passed", "A.two": "failed" } });
      expect(lines(liveStatus("refactor", green, now))).toEqual([["A.two now fails: undo the last change", false]]);
    });

    test("a test added", () => {
      const now = snap({ source: ["A.one", "A.two", "A.three"], results: { "A.one": "passed", "A.two": "passed", "A.three": "passed" } });
      expect(lines(liveStatus("refactor", green, now))).toContainEqual([
        "Tests added or removed: Refactor keeps the tests the same", false,
      ]);
    });

    test("entered with failing tests is an entry problem", () => {
      const failing = snap({ source: ["A.one"], results: { "A.one": "failed" } });
      expect(liveStatus("refactor", failing, failing).entryProblem.kind).toEqual("failing");
    });
  });
});

describe("changedSinceRun", () => {
  test("compares file times with the run, or with a failed build", () => {
    const s = snap({ source: ["A.one"], results: { "A.one": "passed" }, runTime: 10 });
    expect(changedSinceRun(s)).toBe(false);
    s.files[0].mtime = 11;
    expect(changedSinceRun(s)).toBe(true);
    s.build = failedBuild(20);
    expect(changedSinceRun(s)).toBe(false);
  });
});

describe("snapshotOf", () => {
  test("keeps tests, build, runTime, files and git", () => {
    const git = { repo: true, dirtySource: [] };
    const data = { version: 3, run: 2, runTime: 9, tests: [{ name: "A.b" }], build: null, files: [], git, readme: "x" };
    expect(snapshotOf(data)).toEqual({ tests: [{ name: "A.b" }], build: null, runTime: 9, files: [], git });
  });
  test("fills in missing fields", () => {
    expect(snapshotOf({})).toEqual({ tests: [], build: null, runTime: null, files: [], git: null });
  });
  test("no data", () => {
    expect(snapshotOf(null)).toBeNull();
  });
});
