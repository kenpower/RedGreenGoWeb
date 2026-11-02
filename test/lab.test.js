import { parseLab, labStatus, labTestChanges, ownSmellsListed, DEFAULT_REFACTORINGS } from "../src/lab.js";

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

describe("ownSmellsListed: the pair's own smells, before the coach's board", () => {
  // the worksheet's starter smells.md: a heading, a pair line and two examples
  const START = "# Smell log\n\n**Pair:** _name_ & _name_\n\nline:24\tPoor name : `t`\n\nlines:39–44\tDuplicated code : X and O\n";

  test("only lines that weren't there at the start count; blank lines and headings don't", () => {
    expect(ownSmellsListed(START, START)).toEqual({ count: 0, enough: false });
    const two = START + "\nline 12  Magic number: 5\n\n## More\nline 7  Magic number: 7\n";
    expect(ownSmellsListed(START, two)).toEqual({ count: 2, enough: false });
    expect(ownSmellsListed(START, two + "line 21  Poor name: move\n")).toEqual({ count: 3, enough: true });
  });

  test("a smell log table: only new rows with something in them count", () => {
    const table =
      "# Smell log\n\n**Pair:** _name_ & _name_\n\n|Line(s)|Smell|What's wrong|Fixed in|\n|-|-|-|-|\n" +
      "|23|Poor name|`t`||\n| | | | |\n| | | | |\n| | | | |\n";
    const filled = (n) =>
      table
        .replace("_name_ & _name_", "Ann & Bo")
        .replace(/\| \| \| \| \|/g, (row, i) => (n-- > 0 ? `|${12 + i}|Magic number|what is 7?||` : row));
    expect(ownSmellsListed(table, filled(2))).toEqual({ count: 2, enough: false }); // the names don't count
    expect(ownSmellsListed(table, filled(3))).toEqual({ count: 3, enough: true });
    expect(ownSmellsListed(table, table.replace("| | | | |", "|  |  | | |")).count).toBe(0); // still empty
  });

  test("an edited pair line counts like any new line; a missing file counts nothing", () => {
    expect(ownSmellsListed(START, START.replace("_name_ & _name_", "Ann & Bo")).count).toBe(1);
    expect(ownSmellsListed(START, undefined)).toEqual({ count: 0, enough: false });
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

  test("an apostrophe in a comment doesn't hide a rename (the Connect Four header, sent before the .cpp)", () => {
    const header = "// '-' is an empty cell, 'X' and 'O' are the players' pieces.\nclass ConnectFour {\n public:\n  int move(char p) const;\n};";
    const cpp = "int ConnectFour::move(char p) const { if (board[0] == '-') return 0; return -1; }";
    const snapOf = (h, c, tests) => ({
      tests: [],
      files: [
        { path: "ConnectFour.h", kind: "production", content: h },
        { path: "ConnectFour.cpp", kind: "production", content: c },
        { path: "test.cpp", kind: "test", content: tests },
      ],
    });
    const before = snapOf(header, cpp, TEST);
    const renamed = snapOf(header.replace("move(", "bestMoveFor("), cpp.replace("move(", "bestMoveFor("), TEST.replace("g.move", "g.bestMoveFor"));
    expect(labTestChanges(before, renamed).changed).toEqual([]);
    // and a comment edited in a test doesn't change what it checks
    const commented = snapOf(header, cpp, TEST.replace("{\n", "{\n  // the players' last move\n"));
    expect(labTestChanges(before, commented).changed).toEqual([]);
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

  test("a test hold is marked, so the game can offer a Develop step", () => {
    const testsEdited = snap({ tests: TESTS.replace("10", "11") });
    expect(labStatus("refactor", base, testsEdited).lines[1].testsHold).toBe(true);
    expect(labStatus("test", base, snap({ results: { "Price.Basic": "failed" } })).lines[1].testsHold).toBe(true);
    // a broken build is not the tests holding them
    expect(labStatus("test", base, snap({ build: { status: "failed", time: 20, errors: ["e"] } })).lines[1].testsHold).toBeUndefined();
  });

  test("DEVELOP: failing and edited tests don't hold; Done once every test passes again", () => {
    // nothing changed yet: not done, not a problem
    expect(oks(labStatus("develop", base, base))).toEqual([null, null]);
    // the code changed and a test fails, as they said it would
    const red = labStatus("develop", base, snap({ code: "int priceFor(int n) { return n * 11; }", results: { "Price.Basic": "failed" } }));
    expect(oks(red)).toEqual([true, null]);
    expect(red.lines[1].reason).toMatch(/Price\.Basic/);
    expect(red.lines.some((l) => l.ok === false)).toBe(false);
    // the test changed to match: green, so Done
    const green = snap({ code: "int priceFor(int n) { return n * 11; }", tests: TESTS.replace("10", "11") });
    expect(labStatus("develop", base, green).goalMet).toBe(true);
    // a test relaxed on its own is a change too (the worksheet's step 3.4 can start there)
    expect(labStatus("develop", base, snap({ tests: TESTS.replace("EXPECT_EQ", "EXPECT_GE") })).goalMet).toBe(true);
    // tests first don't build yet: expected, not a hold, and not done either
    const broken = labStatus("develop", base, snap({ code: "int priceFor(", build: { status: "failed", time: 20, errors: ["e"] } }));
    expect(broken.lines[1].ok).toBeNull();
    expect(broken.lines[1].reason).toMatch(/tests first/);
    expect(broken.goalMet).toBe(false);
  });

  test("no helper data: nothing to show", () => {
    expect(labStatus("test", base, null)).toBeNull();
  });
});
