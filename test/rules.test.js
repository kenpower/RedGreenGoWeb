import {
  checkRules,
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
