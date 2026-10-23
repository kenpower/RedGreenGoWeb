import { outcomeOf, predictionDue } from "../src/predict.js";
import { GameState } from "../src/gameState";

class LocalStorageMock {
  store = {};
  getItem = (key) => this.store[key] ?? null;
  setItem = (key, value) => (this.store[key] = String(value));
}
global.localStorage = new LocalStorageMock();

const TESTS = "TEST(Price, Basic) {\n  EXPECT_EQ(10, priceFor(1));\n}\nTEST(Price, Two) {\n  EXPECT_EQ(20, priceFor(2));\n}\n";
function snap({ results = { "Price.Basic": "passed", "Price.Two": "passed" }, build = null, runTime = 10, mtime = 5 } = {}) {
  return {
    tests: Object.entries(results).map(([name, status]) => ({ name, status, message: "" })),
    build,
    runTime,
    files: [
      { path: "test.cpp", kind: "test", content: TESTS, mtime },
      { path: "price.cpp", kind: "production", content: "int priceFor(int n) { return n * 10; }", mtime },
    ],
  };
}

describe("outcomeOf: what a fresh run showed", () => {
  test("all passing is green, a failing test or a failed build is red", () => {
    expect(outcomeOf(snap())).toBe("green");
    expect(outcomeOf(snap({ results: { "Price.Basic": "passed", "Price.Two": "failed" } }))).toBe("red");
    expect(outcomeOf(snap({ build: { status: "failed", time: 20, errors: ["C2065"] } }))).toBe("red");
  });

  test("nothing to judge: no data, results older than the code, or a test that never ran", () => {
    expect(outcomeOf(null)).toBeNull();
    expect(outcomeOf(snap({ mtime: 20 }))).toBeNull(); // saved after the run
    expect(outcomeOf(snap({ results: { "Price.Basic": "passed" } }))).toBeNull();
  });
});

describe("predictionDue: a run is coming", () => {
  test("asked when the code changed since the last run, not after a fresh one", () => {
    expect(predictionDue(snap({ mtime: 20 }))).toBe(true);
    expect(predictionDue(snap())).toBe(false);
    expect(predictionDue(null)).toBe(false);
  });
});

describe("gameState: the navigator's predictions", () => {
  test("a guess is settled by the next fresh run, counted and sent to the teacher", () => {
    const g = new GameState();
    g.start();
    g.predict("red", 10);
    expect(g.settlePrediction(10, "green")).toBeNull(); // the same run as the guess: not yet
    expect(g.settlePrediction(30, "red")).toEqual({ guess: "red", outcome: "red", right: true });
    g.predict("green", 30);
    expect(g.settlePrediction(40, "red").right).toBe(false);
    expect(g.progress()).toMatchObject({ predictions_right: 1, predictions_total: 2 });
    expect(g.pendingEvents.filter((e) => e.kind === "prediction").map((e) => e.detail)).toEqual([
      "red -> red: right",
      "green -> red: wrong",
    ]);
    expect(GameState.recoverSavedGame().predictions).toEqual({ right: 1, total: 2 });
  });

  test("a skipped run counts for nothing and doesn't hide the last result", () => {
    const g = new GameState();
    g.start();
    g.predict("green", 10);
    g.settlePrediction(20, "green");
    g.predict(null, 20);
    expect(g.settlePrediction(30, "red")).toBeNull();
    expect(g.prediction).toBeNull();
    expect(g.predictions).toEqual({ right: 1, total: 1 });
    expect(g.lastPrediction.outcome).toBe("green");
  });
});
