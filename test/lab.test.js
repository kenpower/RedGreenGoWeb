import { parseLab, labStatus, DEFAULT_REFACTORINGS } from "../src/lab.js";

const TESTS = 'TEST(Price, Basic) {\n  EXPECT_EQ(10, priceFor(1));\n}\n';
function snap({ tests = TESTS, code = "int priceFor(int n) { return n * 10; }", results = { "Price.Basic": "passed" }, build = null, runTime = 10, git } = {}) {
  return {
    tests: Object.entries(results).map(([name, status]) => ({ name, status, message: "" })),
    build,
    runTime,
    git,
    files: [
      { path: "test.cpp", kind: "test", content: tests },
      { path: "price.cpp", kind: "production", content: code },
    ],
  };
}
const oks = (status) => status.lines.map((l) => l.ok);

describe("parseLab: the README chooses the lab", () => {
  test("Lab: refactor, with the lab's refactorings", () => {
    const readme = "Class code: SD2-2026\nLab: refactor\nRefactorings: Extract Function, Rename Variable; Decompose Conditional.\n";
    expect(parseLab(readme)).toEqual({ refactorings: ["Extract Function", "Rename Variable", "Decompose Conditional"] });
  });

  test("no Refactorings line: a sensible basic list", () => {
    expect(parseLab("# Lab\nlab: Refactoring\n")).toEqual({ refactorings: DEFAULT_REFACTORINGS });
  });

  test("no Lab line: the TDD game", () => {
    expect(parseLab("Refactorings: Extract Function")).toBeNull();
    expect(parseLab("Lab: tdd")).toBeNull();
    expect(parseLab(null)).toBeNull();
  });
});

describe("labStatus: each phase's Done gate", () => {
  const base = snap({ git: { repo: true, head: "aaa", dirtySource: [] } });

  test("REFACTOR: Done once the production code changed and the tests didn't", () => {
    expect(labStatus("refactor", base, base).goalMet).toBe(false);
    const changed = snap({ code: "const int UNIT = 10;\nint priceFor(int n) { return n * UNIT; }" });
    expect(labStatus("refactor", base, changed).goalMet).toBe(true);
    const testsEdited = snap({ code: "int priceFor(int n) { return n * 11; }", tests: TESTS.replace("10", "11") });
    expect(oks(labStatus("refactor", base, testsEdited))).toEqual([true, false]);
  });

  test("TEST: every source test green on a fresh run; a red run says undo", () => {
    expect(labStatus("test", base, snap()).goalMet).toBe(true);
    const red = labStatus("test", base, snap({ results: { "Price.Basic": "failed" } }));
    expect(red.goalMet).toBe(false);
    expect(red.lines[1].text).toMatch(/undo the last change/);
    const stale = snap();
    stale.files[1].mtime = 20; // saved after the run
    expect(labStatus("test", base, stale).lines[1]).toEqual({ text: "Run all the tests (Ctrl+R, A)", ok: null });
    const broken = labStatus("test", base, snap({ build: { status: "failed", time: 20, errors: ["e"] } }));
    expect(broken.lines[1].ok).toBe(false);
  });

  test("COMMIT: Done when HEAD moved and nothing is left uncommitted", () => {
    expect(labStatus("commit", base, snap({ git: { repo: true, head: "aaa", dirtySource: ["price.cpp"] } })).goalMet).toBe(false);
    const half = labStatus("commit", base, snap({ git: { repo: true, head: "bbb", dirtySource: ["price.cpp"] } }));
    expect(oks(half)).toEqual([true, false]);
    expect(labStatus("commit", base, snap({ git: { repo: true, head: "bbb", dirtySource: [] } })).goalMet).toBe(true);
    // no git: the commit can't be checked, so it doesn't hold them
    expect(labStatus("commit", base, snap({ git: { repo: false } })).goalMet).toBe(true);
  });

  test("no helper data: nothing to show", () => {
    expect(labStatus("test", base, null)).toBeNull();
  });
});
