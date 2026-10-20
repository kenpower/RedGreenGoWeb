import {
  checkRules,
  liveStatus,
  changedSinceRun,
  pickRedTest,
  callsCode,
  isVagueTestName,
  untestedFunctions,
  codeFirstAdvice,
  nameAdvice,
  testBodies,
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
  '#include "pch.h"\n' + names.map((n) => n.split(".")).map(([s, t]) => `TEST(${s}, ${t}) {\n  EXPECT_EQ(1, f());\n}\n`).join("\n");

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
      expect(lines(s)).toEqual([["No test is failing yet: write one new test (or change one) so that it fails", false]]);
      expect(s.goalMet).toBe(false);
    });

    test("a test failing since before this Red began says so", () => {
      const failingStart = snap({ source: ["A.one"], results: { "A.one": "failed" } });
      expect(lines(liveStatus("red", failingStart, failingStart))).toEqual([
        ["A.one fails, but it hasn't changed since this Red began: change it, or write a new test", false],
      ]);
    });

    test("the user's toggling: pass → fail → pass → fail on the same test, baseline pinned at the start", () => {
      const PASSING = "TEST(TestCaseName, TestName) {\n  EXPECT_EQ(\"1\", fizzBuzz(1));\n}\n";
      const FAILING = "TEST(TestCaseName, TestName) {\n  EXPECT_EQ(\"2\", fizzBuzz(1));\n}\n";
      const at = (testFile, status) => snap({ testFile, results: { "TestCaseName.TestName": status } });
      // a real (non-template) baseline: the same name, passing, at the start of this Red
      const RENAMED = (body) => body.replace("TestCaseName, TestName", "FizzBuzz, OneGivesOne");
      const baseline = snap({ testFile: RENAMED(PASSING), results: { "FizzBuzz.OneGivesOne": "passed" } });
      const steps = [
        [RENAMED(FAILING), "failed", true],
        [RENAMED(PASSING), "passed", false],
        [RENAMED(FAILING), "failed", true],
      ];
      for (const [file, status, met] of steps) {
        const now = snap({ testFile: file, results: { "FizzBuzz.OneGivesOne": status } });
        expect(liveStatus("red", baseline, now).goalMet).toBe(met);
        expect(checkRules("red", baseline, now).length === 0).toBe(met);
      }
      // and with VS's template test as the baseline
      const templateBase = at(PASSING, "passed");
      expect(liveStatus("red", templateBase, at(FAILING, "failed")).goalMet).toBe(true);
      expect(liveStatus("red", templateBase, at(PASSING, "passed")).goalMet).toBe(false);
      expect(liveStatus("red", templateBase, at(FAILING, "failed")).goalMet).toBe(true);
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

describe("edited tests and the VS template", () => {
  const PLACEHOLDER = "TEST(TestCaseName, TestName) {\n  EXPECT_EQ(1, 1);\n  EXPECT_TRUE(true);\n}\n";
  const fileSnap = (testFile, results, extra = {}) => snap({ testFile, results, ...extra });

  test("a fresh VS project (template test only) starts clean, even if the template already fails", () => {
    expect(startState(fileSnap(PLACEHOLDER, { "TestCaseName.TestName": "passed" }))).toEqual("clean");
    expect(startState(fileSnap(PLACEHOLDER, { "TestCaseName.TestName": "failed" }))).toEqual("clean");
  });

  test("the template edited to call the code and fail is this Red's test", () => {
    const before = fileSnap(PLACEHOLDER, { "TestCaseName.TestName": "passed" });
    const now = fileSnap('TEST(TestCaseName, TestName) {\n  EXPECT_EQ("1", fizzBuzz(1));\n}\n', { "TestCaseName.TestName": "failed" });
    expect(pickRedTest(before, now)).toEqual({ name: "TestCaseName.TestName", how: "new" });
    expect(checkRules("red", before, now)).toEqual([]);
    const live = liveStatus("red", before, now);
    expect(live.goalMet).toBe(true);
    expect(live.lines[0].text).toEqual("New test TestCaseName.TestName: failing ✓ (rename it to say what it checks)");
  });

  test("an existing real test, edited and now failing, is this Red's test", () => {
    const before = snap({ source: ["Calc.Sum"], results: { "Calc.Sum": "passed" } });
    const now = snap({ testFile: "TEST(Calc, Sum) {\n  EXPECT_EQ(3, f());\n}\n", results: { "Calc.Sum": "failed" } });
    expect(pickRedTest(before, now)).toEqual({ name: "Calc.Sum", how: "edited" });
    expect(liveStatus("red", before, now).lines).toEqual([{ text: "Calc.Sum now fails ✓", ok: true }]);
  });

  test("an edited test that still passes isn't enough", () => {
    const before = snap({ source: ["Calc.Sum"], results: { "Calc.Sum": "passed" } });
    const now = snap({ testFile: "TEST(Calc, Sum) {\n  EXPECT_EQ(1, f()); // checked\n  EXPECT_TRUE(f() > 0);\n}\n", results: { "Calc.Sum": "passed" } });
    expect(rules(checkRules("red", before, now))).toEqual(["new_test_passes"]);
    expect(liveStatus("red", before, now).lines).toEqual([{ text: "Calc.Sum passes: make it fail for the right reason", ok: false }]);
  });

  test("an unchanged test that now fails doesn't count as the Red test", () => {
    const before = snap({ source: ["Calc.Sum"], results: { "Calc.Sum": "passed" } });
    const now = snap({ source: ["Calc.Sum"], results: { "Calc.Sum": "failed" } });
    expect(rules(checkRules("red", before, now))).toEqual(["no_new_test"]);
    expect(liveStatus("red", before, now).goalMet).toBe(false);
  });

  test("the user's scratch_test: code first, then the template edited to fail without calling it", () => {
    const testFile =
      'std::string fizzBuzz(int i) {\n  if (i % 15 == 0) return "FizzBuzz";\n  return std::to_string(i);\n}\n\n' +
      "TEST(TestCaseName, TestName) {\n  EXPECT_TRUE(false);\n}\n";
    const before = fileSnap(PLACEHOLDER, { "TestCaseName.TestName": "passed" }, { code: "" });
    const now = fileSnap(testFile, { "TestCaseName.TestName": "failed" }, { code: "" });
    expect(rules(checkRules("red", before, now))).toEqual(["no_code_called"]);
    expect(checkRules("red", before, now)[0].message).toEqual(
      "TestCaseName.TestName fails, but it doesn't call any of your code. Make it call the function you're about to write."
    );
    const live = liveStatus("red", before, now);
    expect(live.goalMet).toBe(false);
    expect(live.lines.map((l) => l.ok)).toEqual([true, false]);
    expect(codeFirstAdvice(now)).toEqual([
      "fizzBuzz was written before any test. In TDD the test comes first; consider deleting it and letting the tests drive it.",
    ]);
  });
});

describe("callsCode", () => {
  const body = (inside) => `TEST(A, b) { ${inside} }`;

  test("literals and gtest macros only: doesn't call any code", () => {
    for (const inside of ["EXPECT_TRUE(false);", "EXPECT_EQ(1, 1);", 'ASSERT_FALSE(true); EXPECT_EQ("a", "a");', "EXPECT_EQ(nullptr, nullptr);"])
      expect(callsCode(body(inside))).toBe(false);
  });

  test("anything else is the pair's code", () => {
    for (const inside of ['EXPECT_EQ("1", fizzBuzz(1));', "Stack s; EXPECT_TRUE(s.isEmpty());", "EXPECT_THROW(add(\"-1\"), std::invalid_argument);"])
      expect(callsCode(body(inside))).toBe(true);
  });
});

describe("untestedFunctions", () => {
  test("functions no test mentions, from production and test files alike", () => {
    const s = snap({
      testFile: "int helper(int x) { return x; }\nTEST(A, one) { EXPECT_EQ(1, f()); }\n",
      code: "int f() { return 1; }\nbool isOdd(int n) { if (n % 2) { return true; } return false; }\n",
    });
    expect(untestedFunctions(s).sort()).toEqual(["helper", "isOdd"]);
  });

  test("a method a test calls is tested", () => {
    const s = snap({
      testFile: "TEST(Stack, empty) { Stack s; EXPECT_TRUE(s.isEmpty()); }\n",
      code: "class Stack {\npublic:\n  bool isEmpty() const { return true; }\n};\n",
    });
    expect(untestedFunctions(s)).toEqual([]);
  });
});

describe("test names", () => {
  test("vague names", () => {
    for (const name of ["TestCaseName.TestName", "A.Test1", "A.MyTest", "A.Test", "A.Foo", "A.Works", "A.ok", "Stack.t2"])
      expect(isVagueTestName(name)).toBe(true);
  });

  test("names that say what they check", () => {
    for (const name of ["Stack.NewStackIsEmpty", "Roman.OneIsI", "Calc.EmptyIsZero", "FizzBuzz.Returns1For1"])
      expect(isVagueTestName(name)).toBe(false);
  });

  test("advice for vague names, but not the Red test (its line says so)", () => {
    const s = snap({ source: ["A.Test1", "A.Foo", "A.Works", "A.SumOfTwo"], results: {} });
    expect(nameAdvice(s, "A.Foo")).toEqual(["Rename A.Test1 to say what it checks.", "Rename A.Works to say what it checks."]);
  });

  test("live advice on Red and Refactor, never on the goal", () => {
    const s = snap({ source: ["A.Test1"], results: { "A.Test1": "passed" } });
    const live = liveStatus("refactor", s, s);
    expect(live.advice).toEqual(["Rename A.Test1 to say what it checks."]);
    expect(live.goalMet).toBe(true);
    expect(liveStatus("green", s, s).advice).toEqual([]);
  });

  test("test bodies change with an edit, not with whitespace or comments", () => {
    const a = snap({ testFile: "TEST(A, b) {\n  EXPECT_EQ(1, f());\n}\n" });
    const b = snap({ testFile: "TEST(A, b) {   EXPECT_EQ(1, f()); // note\n}\n" });
    expect(testBodies(a)).toEqual(testBodies(b));
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
