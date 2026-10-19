import {
  askCoach,
  buildRequest,
  isCoached,
  resolveProblem,
  resetCoach,
  setClassCode,
  shouldShow,
  summariseResult,
  toneOf,
  MASTERY_STREAK,
} from "../src/coach.js";

class MemoryStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return key in this.store ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

beforeEach(() => {
  global.window = { localStorage: new MemoryStorage(), location: { hostname: "localhost", search: "" } };
});

afterAll(() => {
  delete global.window;
});

const snapshot = (code, tests = [{ name: "A.B", status: "passed" }]) => ({
  runTime: 1,
  build: null,
  tests,
  files: [
    { path: "test.cpp", kind: "test", content: "TEST(A, B) {}" },
    { path: "lib.cpp", kind: "production", content: code },
  ],
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
        { name: "Calc.Sum", status: "failed", message: "Expected: 3\nActual: 0" },
        { name: "Calc.Empty", status: "passed" },
      ],
    };
    expect(summariseResult(data)).toEqual("1 failed: Calc.Sum (Expected: 3); 1 passed");
  });

  test("no snapshot yet", () => {
    expect(summariseResult(null)).toEqual("No test results yet");
  });
});

describe("buildRequest", () => {
  test("splits tests from production code, before and after", () => {
    const request = buildRequest({ phase: "green", problem: "Sum numbers", before: snapshot("v1"), after: snapshot("v2") });
    expect(request).toMatchObject({
      phase: "green",
      problem: "Sum numbers",
      tests: "// test.cpp\nTEST(A, B) {}",
      code: "// lib.cpp\nv2",
      tests_before: "// test.cpp\nTEST(A, B) {}",
      code_before: "// lib.cpp\nv1",
      test_result: "All 1 tests passed",
      rule_findings: [],
      history: [],
    });
  });

  test("no before fields at the start of a game", () => {
    const request = buildRequest({ phase: "red", problem: "", before: null, after: snapshot("") });
    expect(request).not.toHaveProperty("tests_before");
    expect(request).not.toHaveProperty("code_before");
  });

  test("keeps findings and history within the server's limits", () => {
    const history = Array.from({ length: 8 }, (_, i) => ({ phase: "red", decision: "advance", note: `n${i}` }));
    const request = buildRequest({
      phase: "red",
      problem: "",
      before: null,
      after: snapshot(""),
      ruleFindings: Array.from({ length: 25 }, () => "x".repeat(600)),
      history,
    });
    expect(request.rule_findings).toHaveLength(20);
    expect(request.rule_findings[0]).toHaveLength(500);
    expect(request.history.map((h) => h.note)).toEqual(["n3", "n4", "n5", "n6", "n7"]);
  });
});

describe("resolveProblem", () => {
  // The helper sends the README as {path, content}, or null.
  const readme = { readme: { path: "README.md", content: "  From the README\n" } };

  test("the text box wins", () => {
    expect(resolveProblem("Typed", readme, { search: "?problem=Linked" })).toEqual("Typed");
  });

  test("then a ?problem= link", () => {
    expect(resolveProblem("  ", readme, { search: "?problem=Linked%20problem" })).toEqual("Linked problem");
  });

  test("then the README's content from the helper", () => {
    expect(resolveProblem("", readme, { search: "" })).toEqual("From the README");
  });

  test("no README falls through to nothing", () => {
    expect(resolveProblem("", { readme: null }, { search: "" })).toEqual("");
    expect(resolveProblem("", { readme: { path: "README.md", content: "" } }, { search: "" })).toEqual("");
  });

  test("else nothing", () => {
    expect(resolveProblem("", null, { search: "" })).toEqual("");
  });

  test("is cut to what the server accepts", () => {
    expect(resolveProblem("x".repeat(9000), null, { search: "" })).toHaveLength(8000);
  });
});

describe("isCoached", () => {
  const connected = { status: "connected", data: snapshot("") };

  test("needs a class code and a connected helper with data", () => {
    expect(isCoached(connected)).toBe(false);
    setClassCode("sd2");
    expect(isCoached(connected)).toBe(true);
    expect(isCoached({ status: "offline", data: snapshot("") })).toBe(false);
    expect(isCoached({ status: "connected", data: null })).toBe(false);
  });
});

describe("askCoach", () => {
  const verdict = { decision: "advance", rule_problems: [], note: "Nice.", advice: false };
  const step = { phase: "red", problem: "", before: null, after: snapshot("") };

  test("sends the request with the class code and returns the verdict", async () => {
    setClassCode("sd2");
    let sent;
    const fetchFn = async (url, options) => {
      sent = { url, options };
      return { ok: true, status: 200, json: async () => verdict };
    };
    expect(await askCoach(step, fetchFn)).toEqual({ verdict, error: "", stale: false });
    expect(sent.url).toEqual("http://127.0.0.1:8100/coach");
    expect(sent.options.headers["X-Class-Code"]).toEqual("SD2");
    expect(JSON.parse(sent.options.body).phase).toEqual("red");
  });

  test.each([
    [403, "The coach doesn't recognise your class code."],
    [429, "Your class has used today's coaching allowance."],
    [500, "The coach couldn't look at this step."],
  ])("a %i becomes a message, never an exception", async (status, message) => {
    const result = await askCoach(step, async () => ({ ok: false, status }));
    expect(result).toEqual({ verdict: null, error: message, stale: false });
  });

  test("a network error becomes a message", async () => {
    const result = await askCoach(step, async () => {
      throw new Error("offline");
    });
    expect(result.error).toEqual("Can't reach the coach right now.");
  });

  test("a reply that arrives after a new game started is stale", async () => {
    let reply;
    const pending = askCoach(step, () => new Promise((resolve) => (reply = resolve)));
    resetCoach();
    reply({ ok: true, status: 200, json: async () => verdict });
    expect((await pending).stale).toBe(true);
  });
});

describe("toneOf", () => {
  test("holds unless the coach advances", () => {
    expect(toneOf({ decision: "redo", advice: false })).toEqual("hold");
    expect(toneOf({ decision: "back_to_red", advice: true })).toEqual("hold");
  });

  test("advancing with or without advice", () => {
    expect(toneOf({ decision: "advance", advice: true })).toEqual("advice");
    expect(toneOf({ decision: "advance", advice: false })).toEqual("good");
  });
});

describe("shouldShow", () => {
  const good = { decision: "advance", advice: false };
  const advice = { decision: "advance", advice: true };
  const hold = { decision: "redo", advice: false };

  test("praises every good step until the streak is reached", () => {
    for (let i = 0; i < MASTERY_STREAK; i++) expect(shouldShow("red", good)).toBe(true);
    expect(shouldShow("red", good)).toBe(false);
  });

  test("always shows holds and advice, and they reset the streak", () => {
    for (let i = 0; i <= MASTERY_STREAK; i++) shouldShow("red", good);
    expect(shouldShow("red", hold)).toBe(true);
    expect(shouldShow("red", good)).toBe(true);
    for (let i = 0; i <= MASTERY_STREAK; i++) shouldShow("green", good);
    expect(shouldShow("green", advice)).toBe(true);
  });

  test("streaks are per phase", () => {
    for (let i = 0; i <= MASTERY_STREAK; i++) shouldShow("red", good);
    expect(shouldShow("green", good)).toBe(true);
  });
});
