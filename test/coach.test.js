import {
  nextBehaviour,
  summariseResult,
  buildStep,
  recordMastery,
  MASTERY_STREAK,
} from "../src/coach.js";
import { fizzbuzz } from "../src/content/katas/fizzbuzz.js";

const next = (covered) => nextBehaviour(fizzbuzz, covered)?.id;

describe("nextBehaviour", () => {
  test("starts at the beginning of the route", () => {
    expect(next([])).toEqual("callable");
  });

  test("follows the teacher's route", () => {
    expect(next(["callable", "returns_string"])).toEqual("normal_one");
  });

  test("a behaviour the route visits twice needs covering twice", () => {
    expect(next(["callable", "returns_string", "normal_one", "normal_more"])).toEqual("normal_more");
  });

  test("skips an optional behaviour once a later one is covered", () => {
    expect(next(["callable", "normal_one"])).toEqual("normal_more");
  });

  test("offers an optional behaviour when nothing later is covered", () => {
    expect(next(["callable"])).toEqual("returns_string");
  });

  test("a required behaviour taken out of order is still asked for", () => {
    const covered = ["callable", "returns_string", "normal_one", "normal_more", "normal_more", "buzz_5"];
    expect(next(covered)).toEqual("fizz_3");
  });

  test("fizz before buzz, then the combined case", () => {
    const covered = ["callable", "returns_string", "normal_one", "normal_more", "normal_more",
      "normal_general", "fizz_3", "fizz_general", "buzz_5"];
    expect(next(covered)).toEqual("fizzbuzz_15");
  });

  test("returns null when the route is done", () => {
    expect(next(fizzbuzz.teacherRoute.flat())).toBeUndefined();
  });

  test("every route entry is a known behaviour", () => {
    const ids = fizzbuzz.behaviours.map((b) => b.id);
    for (const id of fizzbuzz.teacherRoute.flat()) expect(ids).toContain(id);
  });
});

describe("summariseResult", () => {
  test("a build newer than the last test run that failed", () => {
    const data = { runTime: 10, tests: [], build: { status: "failed", time: 20, errors: ["e1", "e2"] } };
    expect(summariseResult(data)).toEqual("Build failed: e1 | e2");
  });

  test("a failed build older than the last test run is ignored", () => {
    const data = {
      runTime: 30,
      tests: [{ name: "A.B", status: "passed" }],
      build: { status: "failed", time: 20, errors: ["e1"] },
    };
    expect(summariseResult(data)).toEqual("All 1 tests passed");
  });

  test("failures with the first line of their message", () => {
    const data = {
      runTime: 10,
      build: null,
      tests: [
        { name: "FizzBuzz.Returns3", status: "failed", message: "Expected: Fizz\nActual: 3" },
        { name: "FizzBuzz.Returns1", status: "passed" },
      ],
    };
    expect(summariseResult(data)).toEqual("1 failed: FizzBuzz.Returns3 (Expected: Fizz); 1 passed");
  });
});

describe("buildStep", () => {
  const data = {
    runTime: 1,
    build: null,
    tests: [{ name: "A.B", status: "passed" }],
    files: [
      { path: "test.cpp", kind: "test", content: "TEST(A, B) {}" },
      { path: "fizzbuzz.cpp", kind: "production", content: "int x;" },
    ],
  };

  test("splits tests from production code", () => {
    const step = buildStep("green", data, { covered: ["callable"], codeAtLastDone: null });
    expect(step).toMatchObject({ kata: "fizzbuzz", phase: "green", covered: ["callable"] });
    expect(step.tests).toEqual("// test.cpp\nTEST(A, B) {}");
    expect(step.code).toEqual("// fizzbuzz.cpp\nint x;");
    expect(step.code_before).toBeUndefined();
  });

  test("sends the earlier code only when it changed", () => {
    const same = buildStep("refactor", data, { covered: [], codeAtLastDone: "// fizzbuzz.cpp\nint x;" });
    expect(same.code_before).toBeUndefined();
    const changed = buildStep("refactor", data, { covered: [], codeAtLastDone: "old" });
    expect(changed.code_before).toEqual("old");
  });
});

describe("recordMastery", () => {
  const good = { rules_ok: true, ordering: "good" };
  const bad = { rules_ok: false, ordering: "n_a" };

  test("shows every verdict until the streak is reached", () => {
    const mastery = {};
    for (let i = 0; i < MASTERY_STREAK; i++) expect(recordMastery(mastery, "red", good)).toBe(true);
    expect(recordMastery(mastery, "red", good)).toBe(false);
  });

  test("always shows a problem, and a problem resets the streak", () => {
    const mastery = { red: MASTERY_STREAK };
    expect(recordMastery(mastery, "red", bad)).toBe(true);
    expect(mastery.red).toEqual(0);
  });

  test("streaks are per phase", () => {
    const mastery = { red: MASTERY_STREAK };
    expect(recordMastery(mastery, "green", good)).toBe(true);
  });
});
