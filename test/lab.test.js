import { parseLab, labStatus, labTestChanges, DEFAULT_REFACTORINGS } from "../src/lab.js";

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

describe("labTestChanges: test edits that only follow the production code are allowed", () => {
  const CODE = "class ConnectFour {\n public:\n  int move(char p) const;\n};\nint ConnectFour::move(char p) const { return -1; }";
  const TEST = "TEST(ChooseMoveTest, FullBoardHasNoMove) {\n  ConnectFour g(full);\n  EXPECT_EQ(-1, g.move('X'));\n}\n";
  const base = snap({ tests: TEST, code: CODE, results: { "ChooseMoveTest.FullBoardHasNoMove": "passed" } });
  const after = (tests, code) => snap({ tests, code, results: { "ChooseMoveTest.FullBoardHasNoMove": "passed" } });

  test("a rename carried into the tests (Ctrl+R, Ctrl+R)", () => {
    const now = after(TEST.replace("g.move", "g.bestMoveFor"), CODE.replaceAll("move(", "bestMoveFor("));
    expect(labTestChanges(base, now).changed).toEqual([]);
    expect(labStatus("refactor", base, now).goalMet).toBe(true);
  });

  test("a magic number replaced by a new constant with that value, qualified or not", () => {
    const code = CODE.replace("public:", "public:\n  static const int NoMove = -1;").replace("return -1", "return NoMove");
    expect(labTestChanges(base, after(TEST.replace("-1", "ConnectFour::NoMove"), code)).changed).toEqual([]);
    expect(labTestChanges(base, after(TEST.replace("-1", "NoMove"), code)).changed).toEqual([]);
  });

  test("still a change: a different expected value, a constant with another value, a name the code didn't gain", () => {
    expect(labTestChanges(base, after(TEST.replace("-1", "0"), CODE)).changed).toEqual(["ChooseMoveTest.FullBoardHasNoMove"]);
    const wrong = CODE.replace("public:", "public:\n  static const int NoMove = -2;");
    expect(labTestChanges(base, after(TEST.replace("-1", "ConnectFour::NoMove"), wrong)).changed).toHaveLength(1);
    // the test renamed, but the production code still says move
    expect(labTestChanges(base, after(TEST.replace("g.move", "g.bestMoveFor"), CODE)).changed).toHaveLength(1);
    // a rename plus a changed argument
    const renamed = CODE.replaceAll("move(", "bestMoveFor(");
    expect(labTestChanges(base, after(TEST.replace("g.move('X')", "g.bestMoveFor('O')"), renamed)).changed).toHaveLength(1);
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

  test("each item's text is the task, the same done or not: a to-do list", () => {
    const changed = snap({ code: "const int UNIT = 10;\nint priceFor(int n) { return n * UNIT; }" });
    const texts = (status) => status.lines.map((l) => l.text);
    expect(texts(labStatus("refactor", base, base))).toEqual(texts(labStatus("refactor", base, changed)));
    expect(labStatus("refactor", base, changed).lines.some((l) => /✓/.test(l.text))).toBe(false);
  });

  test("TEST: every source test green on a fresh run; a red run says undo", () => {
    expect(labStatus("test", base, snap()).goalMet).toBe(true);
    const red = labStatus("test", base, snap({ results: { "Price.Basic": "failed" } }));
    expect(red.goalMet).toBe(false);
    expect(red.lines[1].reason).toMatch(/undo the last change/);
    const stale = snap();
    stale.files[1].mtime = 20; // saved after the run
    expect(labStatus("test", base, stale).lines[1]).toEqual({ text: "Run all the tests (Ctrl+R, A): every test passes", ok: null, howto: "run_tests" });
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
