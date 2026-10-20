import { guideFor, unlockAction, GUIDE_CYCLES } from "../src/guide.js";
import { liveStatus } from "../src/rules.js";

const testFile = (tests) => tests.map(([suite, name, body]) => `TEST(${suite}, ${name}) {\n  ${body}\n}\n`).join("\n");

function snap({ tests = [], results = {}, build = null, runTime = 10, code = "int f() { return 1; }", testText } = {}) {
  return {
    tests: Object.entries(results).map(([name, status]) => ({ name, status, message: "" })),
    build,
    runTime,
    files: [
      { path: "test.cpp", kind: "test", content: testText ?? testFile(tests) },
      { path: "f.cpp", kind: "production", content: code },
    ],
  };
}

const live = (phase, before, now) => (now ? liveStatus(phase, before, now) : null);
const guide = (phase, cycle, before, now) => {
  const status = live(phase, before, now);
  return guideFor(phase, cycle, before, now, status, { locked: !!status && !status.goalMet });
};
const ticks = (items) => items.map((i) => i.done);
const current = (items) => items.findIndex((i) => i.current);

const ONE = ["A", "one", "EXPECT_EQ(1, f());"];
const TWO = ["A", "two", "EXPECT_EQ(2, g());"];
const base = snap({ tests: [ONE], results: { "A.one": "passed" } });
const failedBuild = { status: "failed", errors: ["e"], time: 20 };

describe("which cycles get a guide", () => {
  test("cycles 1 and 2, not from cycle 3", () => {
    expect(guide("red", 1, base, base)).toHaveLength(4);
    expect(guide("red", GUIDE_CYCLES, base, base)).toHaveLength(4);
    expect(guide("red", GUIDE_CYCLES + 1, base, base)).toEqual([]);
  });

  test("Swap only in cycle 1, with the reason for swapping", () => {
    expect(guideFor("swap", 1, null, null, null)[0].why).toMatch(/both learn both halves/);
    expect(guideFor("swap", 2, null, null, null)).toEqual([]);
  });

  test("every item has a short name for 'Not yet: see …'", () => {
    for (const phase of ["red", "green", "refactor"])
      for (const item of guide(phase, 1, base, base)) expect(typeof item.short).toBe("string");
  });
});

describe("red", () => {
  test("nothing written yet: the first item is the one to do", () => {
    const items = guide("red", 1, base, base);
    expect(ticks(items)).toEqual([null, null, null, null]);
    expect(current(items)).toBe(0);
  });

  test("written, not run yet: running is the one to do", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed" } });
    const items = guide("red", 1, base, now);
    expect(ticks(items)).toEqual([true, null, null, null]);
    expect(current(items)).toBe(1);
    expect(items[1].reason).toEqual("two hasn't run yet");
  });

  test("written and doesn't compile: run and failing both ticked, Done is next", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed" }, build: failedBuild });
    const items = guide("red", 1, base, now);
    expect(ticks(items)).toEqual([true, true, true, null]);
    expect(current(items)).toBe(3);
  });

  test("written, run and failing", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });
    const items = guide("red", 1, base, now);
    expect(ticks(items)).toEqual([true, true, true, null]);
    expect(items[2].why).toEqual("The failing test proves it really checks something.");
  });

  test("LOCKED: the new test passes", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "passed" } });
    const items = guide("red", 1, base, now);
    expect(ticks(items)).toEqual([true, true, false, null]);
    expect(items[2].reason).toEqual("It passes: make it fail for the right reason");
    expect(current(items)).toBe(2);
  });

  test("LOCKED: the user's game, a test that doesn't call any code", () => {
    const testText = 'std::string fizzBuzz(int i) { return std::to_string(i); }\n\nTEST(TestCaseName, TestName) {\n  EXPECT_TRUE(false);\n}\n';
    const before = snap({ testText: "TEST(TestCaseName, TestName) {\n  EXPECT_EQ(1, 1);\n}\n", results: { "TestCaseName.TestName": "passed" }, code: "" });
    const now = snap({ testText, results: { "TestCaseName.TestName": "failed" }, code: "" });
    const items = guide("red", 1, before, now);
    expect(items[0]).toMatchObject({ done: false, reason: "Your test doesn't call any of your code", current: true });
    expect(items[3].current).toBeUndefined(); // never "Click Done" while locked
    expect(unlockAction("red", before, now, live("red", before, now))).toEqual({
      driver: "Change TestName so it calls the function you're about to write, e.g. fizzBuzz.",
      navigator: "Check the test calls your code, not just true/false.",
    });
  });

  test("LOCKED: two new tests", () => {
    const now = snap({ tests: [ONE, TWO, ["A", "three", "EXPECT_EQ(3, h());"]], results: {} });
    const items = guide("red", 1, base, now);
    expect(items[0]).toMatchObject({ done: false, reason: "2 new tests: keep one, comment out the others", current: true });
    expect(unlockAction("red", base, now, live("red", base, now)).driver).toEqual("Comment out all but one of the new tests.");
  });

  test("LOCKED: an old failing test that hasn't changed", () => {
    const failingStart = snap({ tests: [ONE], results: { "A.one": "failed" } });
    const items = guide("red", 1, failingStart, failingStart);
    expect(items[0].done).toBe(false);
    expect(items[0].reason).toMatch(/A\.one fails, but it hasn't changed since this Red began/);
    expect(unlockAction("red", failingStart, failingStart, live("red", failingStart, failingStart)).driver).toMatch(
      /^Change one, or write a new test/
    );
  });

  test("LOCKED: code saved after the run", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });
    now.files[0].mtime = 50;
    const items = guide("red", 1, base, now);
    expect(ticks(items)).toEqual([true, null, null, null]);
    expect(items[1]).toMatchObject({ current: true, reason: "You've changed the code since the last run: run the tests" });
    expect(unlockAction("red", base, now, live("red", base, now)).driver).toMatch(/^Run all tests/);
  });

  test("LOCKED: nothing written: the action says to write a test for a new function", () => {
    expect(unlockAction("red", base, base, live("red", base, base)).driver).toMatch(/calls a function that doesn't exist yet/);
  });

  test("goal met: no unlock action", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });
    expect(unlockAction("red", base, now, live("red", base, now))).toBeNull();
  });

  test("without the helper nothing is ticked or current", () => {
    const items = guideFor("red", 1, null, null, null, { locked: true });
    expect(ticks(items)).toEqual([null, null, null, null]);
  });
});

describe("green", () => {
  const redEnd = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });

  test("names the Red test, says why hard-coding is fine", () => {
    const items = guide("green", 1, redEnd, redEnd);
    expect(items[0].text).toEqual("Write the least code that makes A.two pass. Returning the exact expected value is allowed");
    expect(items[0].short).toEqual("make two pass");
    expect(items[0].why).toEqual("The next test will force a real solution.");
    expect(ticks(items)).toEqual([null, true, null, null]);
    expect(current(items)).toBe(0);
    expect(unlockAction("green", redEnd, redEnd, live("green", redEnd, redEnd)).driver).toEqual("Make two pass with the smallest change.");
  });

  test("passing with the tests untouched ticks the first three", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "passed" } });
    const items = guide("green", 2, redEnd, now);
    expect(ticks(items)).toEqual([true, true, true, null]);
    expect(current(items)).toBe(3);
  });

  test("LOCKED: changing the tests", () => {
    const now = snap({ tests: [ONE, ["A", "two", "EXPECT_EQ(1, g());"]], results: { "A.one": "passed", "A.two": "passed" } });
    const items = guide("green", 1, redEnd, now);
    expect(items[1]).toMatchObject({ done: false, reason: "Test files changed: Green only changes production code", current: true });
    expect(unlockAction("green", redEnd, now, live("green", redEnd, now)).driver).toEqual("Undo your changes to the test files.");
  });
});

describe("refactor", () => {
  const green = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "passed" } });

  test("still green is ticked; the rest is advice", () => {
    const items = guide("refactor", 1, green, green);
    expect(ticks(items)).toEqual([null, null, true, null]);
    expect(items[3].text).toEqual("Click Done, then commit");
    expect(current(items)).toBe(3);
  });

  test("LOCKED: a broken test", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });
    const items = guide("refactor", 1, green, now);
    expect(items[2]).toMatchObject({ done: false, reason: "A.two now fails: undo the last change", current: true });
    expect(unlockAction("refactor", green, now, live("refactor", green, now)).driver).toEqual(
      "Undo the last change so all tests pass again."
    );
  });
});
