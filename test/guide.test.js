import { guideFor, GUIDE_CYCLES } from "../src/guide.js";
import { liveStatus } from "../src/rules.js";

const testFile = (tests) => tests.map(([suite, name, body]) => `TEST(${suite}, ${name}) {\n  ${body}\n}\n`).join("\n");

function snap({ tests = [], results = {}, build = null, runTime = 10, code = "int f() { return 1; }" } = {}) {
  return {
    tests: Object.entries(results).map(([name, status]) => ({ name, status, message: "" })),
    build,
    runTime,
    files: [
      { path: "test.cpp", kind: "test", content: testFile(tests) },
      { path: "f.cpp", kind: "production", content: code },
    ],
  };
}

const guide = (phase, cycle, before, now) => guideFor(phase, cycle, before, now, now ? liveStatus(phase, before, now) : null);
const ticks = (items) => items.map((i) => i.done);

const ONE = ["A", "one", "EXPECT_EQ(1, f());"];
const TWO = ["A", "two", "EXPECT_EQ(2, g());"];
const base = snap({ tests: [ONE], results: { "A.one": "passed" } });

describe("which cycles get a guide", () => {
  test("cycles 1 and 2, not from cycle 3", () => {
    expect(guide("red", 1, base, base)).toHaveLength(4);
    expect(guide("red", GUIDE_CYCLES, base, base)).toHaveLength(4);
    expect(guide("red", GUIDE_CYCLES + 1, base, base)).toEqual([]);
  });

  test("Swap only in cycle 1, with the reason for swapping", () => {
    expect(guide("swap", 1, null, null)[0].why).toMatch(/both learn both halves/);
    expect(guide("swap", 2, null, null)).toEqual([]);
  });
});

describe("red", () => {
  test("nothing written yet", () => {
    expect(ticks(guide("red", 1, base, base))).toEqual([false, null, null, null]);
  });

  test("written, not run yet", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed" } });
    expect(ticks(guide("red", 1, base, now))).toEqual([true, false, null, null]);
  });

  test("written and doesn't compile: run and failing both ticked", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed" }, build: { status: "failed", errors: ["e"], time: 20 } });
    expect(ticks(guide("red", 1, base, now))).toEqual([true, true, true, null]);
  });

  test("written, run and failing", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });
    const items = guide("red", 1, base, now);
    expect(ticks(items)).toEqual([true, true, true, null]);
    expect(items[2].why).toEqual("The failing test proves it really checks something.");
  });

  test("written, run and passing: the failing step isn't ticked", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "passed" } });
    expect(ticks(guide("red", 1, base, now))).toEqual([true, true, false, null]);
  });

  test("edited after the run: run again", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });
    now.files[0].mtime = 50;
    expect(ticks(guide("red", 1, base, now))).toEqual([true, false, null, null]);
  });

  test("without the helper nothing is ticked", () => {
    expect(ticks(guide("red", 1, null, null))).toEqual([null, null, null, null]);
  });
});

describe("green", () => {
  const redEnd = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });

  test("names the Red test, says why hard-coding is fine", () => {
    const items = guide("green", 1, redEnd, redEnd);
    expect(items[0].text).toEqual("Write the least code that makes A.two pass. Returning the exact expected value is allowed");
    expect(items[0].why).toEqual("The next test will force a real solution.");
    expect(ticks(items)).toEqual([false, true, null, null]);
  });

  test("passing with the tests untouched ticks the first three", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "passed" }, code: "int f() { return 1; } int g() { return 2; }" });
    expect(ticks(guide("green", 2, redEnd, now))).toEqual([true, true, true, null]);
  });

  test("changing the tests is flagged", () => {
    const now = snap({ tests: [ONE, ["A", "two", "EXPECT_EQ(1, g());"]], results: { "A.one": "passed", "A.two": "passed" } });
    expect(guide("green", 1, redEnd, now)[1].done).toBe(false);
  });
});

describe("refactor", () => {
  const green = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "passed" } });

  test("still green is ticked; the rest is advice", () => {
    expect(ticks(guide("refactor", 1, green, green))).toEqual([null, null, true, null]);
    expect(guide("refactor", 1, green, green)[3].text).toEqual("Click Done, then commit");
  });

  test("a broken test is flagged", () => {
    const now = snap({ tests: [ONE, TWO], results: { "A.one": "passed", "A.two": "failed" } });
    expect(guide("refactor", 1, green, now)[2].done).toBe(false);
  });
});
