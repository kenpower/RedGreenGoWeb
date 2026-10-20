import {
  STEPS, stepById, catalogueFor, groupSteps, pickSteps, cardSteps, hasGuidance, nextStepsDue, codeKey, runMark,
  NEXT_STEPS_GAP,
} from "../src/content/steps.js";
import { liveStatus } from "../src/rules.js";

function snap({ testFile = "", code = "", results = {}, build = null, runTime = 10, git } = {}) {
  return {
    tests: Object.entries(results).map(([name, status]) => ({ name, status, message: "" })),
    build,
    runTime,
    git,
    files: [
      { path: "test.cpp", kind: "test", content: testFile },
      { path: "fizz.hpp", kind: "production", content: code },
    ],
  };
}

const PLACEHOLDER = "TEST(TestCaseName, TestName) {\n  EXPECT_EQ(1, 1);\n}\n";
const check = (id, before, now) => stepById(id).check(before, now, now ? liveStatus(stepById(id).phase, before, now) : null);

describe("the catalogue", () => {
  test("ids are unique, phases known, texts present", () => {
    const ids = STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STEPS) {
      expect(["red", "green", "refactor"]).toContain(s.phase);
      expect(s.id.startsWith(s.phase + ".")).toBe(true);
      expect(s.text.length).toBeGreaterThan(10);
      expect(typeof s.required).toBe("boolean");
    }
  });

  test("each phase has both kinds of step", () => {
    for (const phase of ["red", "green", "refactor"]) {
      const steps = STEPS.filter((s) => s.phase === phase);
      expect(steps.some((s) => s.required)).toBe(true);
      expect(steps.some((s) => !s.required)).toBe(true);
    }
  });

  test("catalogueFor gives the coach just ids and texts for one phase", () => {
    const red = catalogueFor("red");
    expect(red.every((c) => Object.keys(c).sort().join() === "id,text")).toBe(true);
    expect(red.every((c) => c.id.startsWith("red."))).toBe(true);
  });
});

describe("checks", () => {
  const before = snap({ testFile: PLACEHOLDER, results: { "TestCaseName.TestName": "passed" } });

  test("the user's case: the test already calls fizzBuzz and passes", () => {
    const now = snap({
      testFile: '#include "fizz.hpp"\nTEST(TestCaseName, TestName) {\n  EXPECT_TRUE(fizzBuzz(1) == "1");\n}\n',
      code: "std::string fizzBuzz(int n) { return std::to_string(n); }",
      results: { "TestCaseName.TestName": "passed" },
    });
    expect(check("red.call_missing_function", before, now)).toBe(true);
    expect(check("red.call_your_code", before, now)).toBe(true);
    expect(check("red.run_tests", before, now)).toBe(true);
    expect(check("red.make_it_fail_for_right_reason", before, now)).toBe(false);
    expect(check("red.rename_test", before, now)).toBe(false);
  });

  test("a test calling no code", () => {
    const now = snap({ testFile: "TEST(TestCaseName, TestName) {\n  EXPECT_TRUE(false);\n}\n", results: { "TestCaseName.TestName": "failed" } });
    expect(check("red.call_your_code", before, now)).toBe(false);
  });

  test("nothing written yet: can't tell", () => {
    expect(check("red.call_missing_function", before, before)).toBeNull();
  });

  test("green: tests left alone (an #include is fine), all green", () => {
    const redEnd = snap({ testFile: "TEST(F, One) {\n  EXPECT_EQ(\"1\", fizzBuzz(1));\n}\n", results: { "F.One": "failed" } });
    const now = snap({
      testFile: '#include "fizz.hpp"\nTEST(F, One) {\n  EXPECT_EQ("1", fizzBuzz(1));\n}\n',
      code: 'std::string fizzBuzz(int) { return "1"; }',
      results: { "F.One": "passed" },
    });
    expect(check("green.leave_tests", redEnd, now)).toBe(true);
    expect(check("green.all_green", redEnd, now)).toBe(true);
    expect(check("green.least_code", redEnd, now)).toBe(true);
  });

  test("refactor: commit is ticked once nothing is uncommitted", () => {
    const clean = snap({ git: { repo: true, dirtySource: [] } });
    const dirty = snap({ git: { repo: true, dirtySource: ["fizz.hpp"] } });
    expect(check("refactor.commit", null, clean)).toBe(true);
    expect(check("refactor.commit", null, dirty)).toBe(false);
  });
});

describe("groupSteps", () => {
  const before = snap({ testFile: PLACEHOLDER, results: { "TestCaseName.TestName": "passed" } });
  const now = snap({
    testFile: 'TEST(TestCaseName, TestName) {\n  EXPECT_TRUE(fizzBuzz(1) == "1");\n}\n',
    results: { "TestCaseName.TestName": "passed" },
  });
  const live = liveStatus("red", before, now);

  test("required steps go under Needed, optional under Good practice, in the coach's order", () => {
    const g = groupSteps(
      "red",
      [
        { id: "red.rename_test", detail: "Call it ReturnsFizzForThree." },
        { id: "red.make_it_fail_for_right_reason", detail: "Test 3 instead, expecting Fizz." },
        { id: "red.run_tests", detail: "" },
      ],
      null, before, now, live
    );
    expect(g.needed.map((s) => s.id)).toEqual(["red.make_it_fail_for_right_reason", "red.run_tests"]);
    expect(g.practice.map((s) => s.id)).toEqual(["red.rename_test"]);
    expect(g.needed[0]).toMatchObject({ done: false, detail: "Test 3 instead, expecting Fizz.", current: true });
  });

  test("good practice never shows ✖", () => {
    const g = groupSteps("red", [{ id: "red.rename_test", detail: "" }], null, before, now, live);
    expect(g.practice[0].done).toBeNull();
  });

  test("unknown ids and other phases' steps are dropped", () => {
    const g = groupSteps("red", [{ id: "red.nope" }, { id: "green.fake_it" }, "red.run_tests"], null, before, now, live);
    expect(g.needed.map((s) => s.id)).toEqual(["red.run_tests"]);
  });

  test("Green/Refactor after a change: running the tests comes first, even if not chosen", () => {
    const green = snap({ testFile: "TEST(F, One) {\n  EXPECT_EQ(1, f());\n}\n", code: "int f() { return 1; }", results: { "F.One": "passed" } });
    const edited = { ...green, files: green.files.map((f) => ({ ...f, mtime: f.kind === "production" ? 50 : 5 })) };
    const g = groupSteps("refactor", [{ id: "refactor.still_green", detail: "" }], null, green, edited, liveStatus("refactor", green, edited));
    expect(g.needed[0]).toMatchObject({ id: "refactor.run_tests", done: false, current: true });
  });

  test("the free-text extra goes at the end of its group, without a tick", () => {
    const g = groupSteps("red", [], { text: "Ask your teacher about the header.", needed: false }, before, now, live);
    expect(g.practice).toEqual([{ id: "extra", text: "Ask your teacher about the header.", done: null, extra: true }]);
  });
});

describe("cardSteps: the coach's guidance, else the rule-picked steps", () => {
  const before = snap({ testFile: 'TEST(Fizz, OneIsOne) {\n  EXPECT_EQ("1", fizzBuzz(1));\n}\n' });
  const now = snap({
    testFile: 'TEST(Fizz, OneIsOne) {\n  EXPECT_EQ("1", fizzBuzz(1));\n}\n',
    code: 'std::string fizzBuzz(int n) { return "1"; }\nstd::string fizz() { return "Fizz"; }\n',
    results: { "Fizz.OneIsOne": "passed" },
  });
  const live = liveStatus("green", before, now);
  const ids = (card) => [...card.needed, ...card.practice].map((s) => s.id);

  test("a held Done's Look is the verdict alone, so the card shows the rule-picked steps", () => {
    const heldDone = { decision: "redo", note: "Take out the extra code.", steps: [], extra: "", extra_needed: false };
    expect(hasGuidance(heldDone)).toBe(false);
    const card = cardSteps("green", heldDone, before, now, live, { novice: true });
    const picked = pickSteps("green", before, now, live, { novice: true }).map((s) => s.id);
    expect(picked.length).toBeGreaterThan(0);
    expect(ids(card)).toEqual(expect.arrayContaining(picked));
    expect(ids(card)).toEqual(ids(cardSteps("green", null, before, now, live, { novice: true })));
  });

  test("a Look with guidance shows the coach's steps, in its order, with its extra", () => {
    const look = { decision: "advance", steps: [{ id: "green.all_green", detail: "Both pass." }], extra: "Commit now.", extra_needed: false };
    expect(hasGuidance(look)).toBe(true);
    const card = cardSteps("green", look, before, now, live);
    expect(ids(card)).toEqual(["green.all_green", "extra"]);
    expect(hasGuidance({ steps: [], extra: "Ask your teacher." })).toBe(true);
  });
});

describe("pickSteps: the card fits the code, without the coach", () => {
  const ids = (phase, before, now, novice = true) =>
    pickSteps(phase, before, now, liveStatus(phase, before, now), { novice }).map((s) => s.id);

  test("every step has an applies()", () => {
    for (const s of STEPS) expect(typeof s.applies).toBe("function");
  });

  test("the user's case: an empty fizzBuzz stub and a test that already calls it, not run yet", () => {
    const now = snap({
      testFile: '#include "fizz.hpp"\nTEST(TestCaseName, TestName) {\n  EXPECT_TRUE(fizzBuzz(1) == "1");\n}\n',
      code: "std::string fizzBuzz(int n) {}",
      results: {},
    });
    const picked = ids("red", now, now); // the start check took this as the baseline
    expect(picked).not.toContain("red.call_missing_function");
    expect(picked).toEqual(expect.arrayContaining(["red.rename_test"]));
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(picked.length).toBeLessThanOrEqual(5);
  });

  test("...and once it has run and passes: make it fail for the right reason", () => {
    const now = snap({
      testFile: 'TEST(TestCaseName, TestName) {\n  EXPECT_TRUE(fizzBuzz(1) == "1");\n}\n',
      code: "std::string fizzBuzz(int n) { return std::to_string(n); }",
      results: { "TestCaseName.TestName": "passed" },
    });
    const picked = ids("red", now, now);
    expect(picked[0]).toEqual("red.make_it_fail_for_right_reason");
    expect(picked).not.toContain("red.call_missing_function");
    expect(picked).toContain("red.rename_test");
  });

  test("a new test written but not run yet: run the tests", () => {
    const before = snap({ testFile: 'TEST(F, One) {\n  EXPECT_EQ("1", fizzBuzz(1));\n}\n', results: { "F.One": "passed" } });
    const now = snap({
      testFile: 'TEST(F, One) {\n  EXPECT_EQ("1", fizzBuzz(1));\n}\nTEST(F, Three) {\n  EXPECT_EQ("Fizz", fizzBuzz(3));\n}\n',
      results: { "F.One": "passed" },
    });
    expect(ids("red", before, now)).toContain("red.run_tests");
  });

  test("a truly empty project (VS's template only): call a function that doesn't exist yet", () => {
    const empty = snap({ testFile: PLACEHOLDER, results: { "TestCaseName.TestName": "passed" } });
    const picked = ids("red", empty, empty);
    expect(picked[0]).toEqual("red.call_missing_function");
  });

  test("code written before any test: suggest removing it", () => {
    const codeFirst = snap({
      testFile: PLACEHOLDER,
      code: 'std::string fizzBuzz(int n) { if (n % 3 == 0) return "Fizz"; return std::to_string(n); }',
      results: { "TestCaseName.TestName": "passed" },
    });
    expect(ids("red", codeFirst, codeFirst)).toContain("red.remove_code_before_test");
  });

  test("required steps come before good practice, and later cycles get less practice", () => {
    const empty = snap({ testFile: PLACEHOLDER, results: { "TestCaseName.TestName": "passed" } });
    const novice = pickSteps("red", empty, empty, liveStatus("red", empty, empty), { novice: true });
    const later = pickSteps("red", empty, empty, liveStatus("red", empty, empty), { novice: false });
    const required = (list) => list.map((s) => stepById(s.id).required);
    expect(required(novice)).toEqual([...required(novice)].sort((a, b) => b - a)); // trues first
    expect(later.length).toBeLessThanOrEqual(novice.length);
  });

  test("green: the build can't find the function", () => {
    const redEnd = snap({ testFile: 'TEST(F, One) {\n  EXPECT_EQ("1", fizzBuzz(1));\n}\n', results: {} });
    const now = {
      ...redEnd,
      build: { status: "failed", time: 20, errors: ["test.cpp(2): error C3861: 'fizzBuzz': identifier not found"] },
    };
    expect(ids("green", redEnd, now)).toEqual(expect.arrayContaining(["green.create_function"]));
  });
});

describe("when to ask for next steps", () => {
  test("as soon as a step starts with code, even before any run", () => {
    expect(nextStepsDue(null, 1, snap({ code: "int f() { return 1; }", runTime: 0 }), 1000)).toBe(true);
  });

  const a = snap({ code: "a", runTime: 100 });
  const look = (s, step, at) => ({ step, run: runMark(s), code: codeKey(s), at });

  test("not before there are any results", () => {
    expect(nextStepsDue(null, 3, snap({ runTime: 0 }), 1000)).toBe(false);
  });

  test("the first look at a step", () => {
    expect(nextStepsDue(null, 3, a, 1000)).toBe(true);
    expect(nextStepsDue(look(a, 2, 900), 3, a, 1000)).toBe(true);
  });

  test("again only with a new run AND changed code", () => {
    const last = look(a, 3, 1000);
    const later = 1000 + NEXT_STEPS_GAP + 1;
    expect(nextStepsDue(last, 3, snap({ code: "a", runTime: 200 }), later)).toBe(false); // same code
    expect(nextStepsDue(last, 3, { ...a, files: snap({ code: "b" }).files }, later)).toBe(false); // no new run
    expect(nextStepsDue(last, 3, snap({ code: "b", runTime: 200 }), later)).toBe(true);
  });

  test("at most once a minute, even across steps", () => {
    const last = look(a, 3, 1000);
    expect(nextStepsDue(last, 4, snap({ code: "b", runTime: 200 }), 1000 + NEXT_STEPS_GAP - 1)).toBe(false);
    expect(nextStepsDue(last, 4, snap({ code: "b", runTime: 200 }), 1000 + NEXT_STEPS_GAP)).toBe(true);
  });

  test("a build counts as new results", () => {
    const last = look(a, 3, 1000);
    const built = { ...snap({ code: "b", runTime: 100 }), build: { status: "failed", time: 300, errors: ["e"] } };
    expect(nextStepsDue(last, 3, built, 2000)).toBe(true);
  });
});
