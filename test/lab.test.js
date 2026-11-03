import { parseLab, labStatus, labTestChanges, ownSmellsListed, labLookDue, DEFAULT_REFACTORINGS } from "../src/lab.js";
import { codeKey, runMark } from "../src/content/steps.js";

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

  test("a rename committed in an earlier round, the tests only fixed now (the lab's start code)", () => {
    // round 1 renamed move() and was committed with the tests still calling move
    const renamed = CODE.replaceAll("move(", "bestMoveFor(");
    const round2Base = after(TEST, renamed);
    const fixed = after(TEST.replace("g.move", "g.bestMoveFor"), renamed);
    expect(labTestChanges(round2Base, fixed).changed).toHaveLength(1); // against the round's base alone
    expect(labTestChanges(round2Base, fixed, base).changed).toEqual([]);
    expect(labStatus("test", round2Base, fixed, { start: base }).goalMet).toBe(true);
    // a real change to what the test checks still counts
    const worse = after(TEST.replace("g.move('X')", "g.bestMoveFor('O')"), renamed);
    expect(labTestChanges(round2Base, worse, base).changed).toHaveLength(1);
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

describe("labLookDue: the lab's coach looks at each saved change, at most once a minute", () => {
  const first = snap();
  const seen = (s, at, stale = false) => ({ round: 1, code: codeKey(s), run: runMark(s), stale, at });

  test("the first Look of a round, then only when the code changed", () => {
    expect(labLookDue(null, 1, first, 100)).toEqual({ due: true, retryIn: 0 });
    expect(labLookDue(seen(first, 0), 1, first, 100).due).toBe(false);
    expect(labLookDue(seen(first, 0), 2, first, 100).due).toBe(true); // a new round
  });

  test("a saved change is looked at without waiting for a run", () => {
    const edited = snap({ code: "int priceFor(int n) { return n * 10 + 0; }" });
    expect(labLookDue(seen(first, 0), 1, edited, 100)).toEqual({ due: true, retryIn: 0 });
  });

  test("inside the minute: not yet, and when to try again", () => {
    const edited = snap({ code: "int priceFor(int n) { return n * 10 + 0; }" });
    expect(labLookDue(seen(first, 80), 1, edited, 100)).toEqual({ due: false, retryIn: 40 });
  });

  test("a fresh run after a Look at stale results is worth another Look; another run of the same code isn't", () => {
    const rerun = snap({ runTime: 50 });
    expect(labLookDue(seen(first, 0, true), 1, rerun, 100).due).toBe(true);
    expect(labLookDue(seen(first, 0, false), 1, rerun, 100).due).toBe(false);
  });
});

describe("labStatus: why an item isn't ticked", () => {
  const why = (status) => status.lines.map((l) => l.why || null);
  test("an unchanged refactor says the app compared the production code, a ticked item says nothing", () => {
    const base = snap();
    expect(why(labStatus("refactor", base, base))[0]).toMatch(/compares the production code/);
    expect(why(labStatus("refactor", base, base))[1]).toBe(null);
  });
  test("an uncommitted round names the commit it's still on and the files git lists", () => {
    const base = { ...snap(), git: { repo: true, head: "abcdef1234", dirtySource: [] } };
    const now = { ...snap(), git: { repo: true, head: "abcdef1234", dirtySource: ["ConnectFour.cpp"] } };
    const [commit, left] = why(labStatus("commit", base, now));
    expect(commit).toMatch(/abcdef12/);
    expect(left).toMatch(/ConnectFour\.cpp/);
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
    expect(labStatus("test", base, stale).lines[1]).toEqual({
      text: "Run all the tests (Ctrl+R, A): every test passes",
      ok: null,
      howto: "run_tests",
      why: expect.stringMatching(/older than your last saved change/),
    });
    const broken = labStatus("test", base, snap({ build: { status: "failed", time: 20, errors: ["e"] } }));
    expect(broken.lines[1].ok).toBe(false);
  });

  test("TEST, CMake: a test program older than the code is not a pass (ctest without a build, or a failed build)", () => {
    // ctest run after the save, but the program was built before it: the old code was tested
    const ranOld = { ...snap({ runTime: 30 }), binaryTime: 10 };
    ranOld.files[1].mtime = 20;
    const line = labStatus("test", base, ranOld).lines[1];
    expect(line.ok).toBe(false);
    expect(line.reason).toMatch(/tested the old program: build/);
    expect(line.why).toMatch(/wasn't rebuilt/);
    // saved, a build that failed, no new run: no build log with CMake, so say what may have happened
    const notRun = { ...snap({ runTime: 10 }), binaryTime: 10 };
    notRun.files[1].mtime = 20;
    const waiting = labStatus("test", base, notRun).lines[1];
    expect(waiting.ok).toBe(null);
    expect(waiting.reason).toMatch(/If the build failed, fix its first error/);
    expect(waiting.why).toMatch(/build probably failed/);
    // rebuilt and run after the save: a pass
    const fresh = { ...snap({ runTime: 30 }), binaryTime: 25 };
    fresh.files[1].mtime = 20;
    expect(labStatus("test", base, fresh).goalMet).toBe(true);
    // Visual Studio (no binaryTime): as before
    const vs = snap({ runTime: 30 });
    vs.files[1].mtime = 20;
    expect(labStatus("test", base, vs).goalMet).toBe(true);
  });

  test("COMMIT: Done when HEAD moved and nothing is left uncommitted", () => {
    const named = "Replace Magic Number with Constant: UNIT in priceFor";
    expect(labStatus("commit", base, snap({ git: { repo: true, head: "aaa", dirtySource: ["price.cpp"] } })).goalMet).toBe(false);
    const half = labStatus("commit", base, snap({ git: { repo: true, head: "bbb", headMessage: named, dirtySource: ["price.cpp"] } }));
    expect(oks(half)).toEqual([true, false]);
    expect(labStatus("commit", base, snap({ git: { repo: true, head: "bbb", headMessage: named, dirtySource: [] } })).goalMet).toBe(true);
    // no git: the commit can't be checked, so it doesn't hold them
    expect(labStatus("commit", base, snap({ git: { repo: false } })).goalMet).toBe(true);
  });

  test("COMMIT: the message names the refactoring; a Develop round's says what changed", () => {
    const commit = (headMessage, options) =>
      labStatus("commit", base, snap({ git: { repo: true, head: "bbb", headMessage, dirtySource: [] } }), options).lines[0];
    const lab = { refactorings: ["Rename Variable", "Merge Loops"] };
    expect(commit("fixed stuff", lab)).toMatchObject({ ok: false, howto: "amend", reason: expect.stringMatching(/doesn't say which refactoring/) });
    expect(commit("fixed stuff", lab).why).toMatch(/Rename Variable, Merge Loops/);
    expect(commit("Rename Variable: c and p in play", lab).ok).toBe(true);
    expect(commit("2.3 merge loops in bestMoveFor", lab).ok).toBe(true); // anywhere, any case
    expect(commit("Rename move to bestMoveFor", lab).ok).toBe(true); // the glossary's one-word name, at the start
    expect(commit("Extract Function: indexOf", lab).ok).toBe(true); // the glossary's, though not the lab's
    expect(commit("magic number fixed", lab).ok).toBe(false); // a smell isn't a refactoring
    const develop = commit("simplify the default move", { ...lab, develop: true });
    expect(develop).toMatchObject({ ok: true, text: "Commit, with a message that says what changed" });
  });

  test("DEVELOP: tests that check the old behaviour are changed, not deleted", () => {
    const two = TESTS + "TEST(Price, Two) {\n  EXPECT_EQ(20, priceFor(2));\n}\n";
    const devBase = snap({ tests: two, results: { "Price.Basic": "passed", "Price.Two": "passed" } });
    const changedCode = "int priceFor(int n) { return n * 11; }";
    const deleted = labStatus("develop", devBase, snap({ code: changedCode }));
    const line = deleted.lines.find((l) => /don't delete them/.test(l.text));
    expect(line).toMatchObject({ ok: false, reason: expect.stringMatching(/Deleted: Price\.Two/) });
    expect(deleted.goalMet).toBe(false);
    // renamed (one out, one in): fine
    const renamed = snap({ code: changedCode, tests: two.replace("Price, Two", "Price, TwoItems").replace("20", "22") });
    expect(labStatus("develop", devBase, renamed).lines.some((l) => /don't delete them/.test(l.text))).toBe(false);
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
