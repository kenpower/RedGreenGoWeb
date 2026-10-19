import { GameState, states, TDDPhase, HISTORY_LENGTH } from "../src/gameState";
import { hintFor, phaseHints } from "../src/content/hints.js";

class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock();

test("check localstorage mock", () => {
  localStorage.setItem("aKey", "my string");
  const s = localStorage.getItem("aKey");
  expect(s).toEqual("my string");
});

const isInitialState = (g) => {
  expect(g.players[0]).toEqual("John");
  expect(g.driver).toEqual(0);
  expect(g.navigator).toEqual(1);
  expect(g.state).toEqual(states[0]);
  expect(g.stepNumber).toEqual(1);
  expect(g.iteration).toEqual(0);
  expect(g.started).toEqual(false);
};

test("initialisation", () => {
  let g = new GameState();
  isInitialState(g);
});

test("start", () => {
  let g = new GameState();
  g.start();
  expect(g.started).toBe(true);
  expect(g.iterations).toEqual([{ index: 1, phase: TDDPhase.RED, backToRed: 0 }]);
});

test("next_step_1_times", () => {
  let g = new GameState();
  g.start();
  g.nextStep();
  expect(g.state.id).toBe("swap");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(0);
  expect(g.iterations[0].phase).toBe(TDDPhase.GREEN);
});

test("next_step_2_times", () => {
  let g = new GameState();
  g.start();
  g.nextStep();
  g.nextStep();
  expect(g.state.id).toBe("green");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(0);
  expect(g.iterations[0].phase).toBe(TDDPhase.GREEN);
});

test("next_step_3_times", () => {
  let g = new GameState();
  g.start();
  for (var i = 0; i < 3; i++) g.nextStep();

  expect(g.state.id).toBe("refactor");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(0);
  expect(g.iterations[0].phase).toBe(TDDPhase.REFACTOR);
});

test("next_step_4_times", () => {
  let g = new GameState();
  g.start();
  for (var i = 0; i < 4; i++) g.nextStep();

  expect(g.state.id).toBe("red");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(0);
  expect(g.iterations[1].phase).toBe(TDDPhase.RED);
  expect(g.iterations[0].phase).toBe(TDDPhase.COMPLETED);
});

test("next_step_5_times", () => {
  let g = new GameState();
  g.start();
  for (var i = 0; i < 5; i++) g.nextStep();

  expect(g.state.id).toBe("swap");
  expect(g.driver).toBe(0);
  expect(g.navigator).toBe(1);
  expect(g.iterations[1].phase).toBe(TDDPhase.GREEN);
});

test("next_step_5_times", () => {
  let g = new GameState();
  g.start();
  for (var i = 0; i < 5; i++) g.nextStep();

  expect(g.state.id).toBe("swap");
  expect(g.driver).toBe(0);
  expect(g.navigator).toBe(1);
  expect(g.iterations[1].phase).toBe(TDDPhase.GREEN);
});

test("next_step_16_times", () => {
  let g = new GameState();
  g.start();
  for (var i = 0; i < 16; i++) g.nextStep();

  expect(g.state.id).toBe("red");
  expect(g.driver).toBe(0);
  expect(g.navigator).toBe(1);
  expect(g.iterations[4].phase).toBe(TDDPhase.RED);
  expect(g.iterations[3].phase).toBe(TDDPhase.COMPLETED);
  expect(g.stepNumber).toBe(17);
});

test("get_step_after_0_nexts", () => {
  let g = new GameState();
  g.start();
  const step = g.getStep();
  expect(step.stateName).toBe("red");
  expect(step.cycle).toBe(1);
  expect(step.driver).toBe("John");
});

test("get_step_after_1_nexts", () => {
  let g = new GameState();
  g.start();
  g.nextStep();
  const step = g.getStep();
  expect(step.stateName).toBe("swap");
  expect(step.cycle).toBe(1);
  expect(step.driver).toBe("Jane");
  expect(step.title).toBe("Swap pair programming roles");
});

test("get_step_after_3_nexts", () => {
  let g = new GameState();
  g.start();
  g.nextStep();
  g.nextStep();
  g.nextStep();
  const step = g.getStep();
  expect(step.stateName).toBe("refactor");
  expect(step.cycle).toBe(1);
  expect(step.driver).toBe("Jane");
  expect(step.title).toBe("Step:4 Make it Clean");
  expect(step.navigators).toEqual(["John"]);
});

test("recover_step_from_local_storage", () => {
  let g = new GameState();
  g.players[2] = "player3";
  g.start();
  g.nextStep();
  g.nextStep();
  g.nextStep();

  let recoveredFromLocalStorage = GameState.recoverSavedGame();
  const step = recoveredFromLocalStorage.getStep();
  expect(step.stateName).toBe("refactor");
  expect(step.cycle).toBe(1);
  expect(step.driver).toBe("Jane");
  expect(step.title).toBe("Step:4 Make it Clean");

  expect(recoveredFromLocalStorage.players[2]).toBe("player3");
});

test("restart Game (bug repro)", () => {
  let g = new GameState();
  g.start();
  g.nextStep();
  g.nextStep();
  g.nextStep();

  g = new GameState();
  isInitialState(g);

  let recoveredFromLocalStorage = GameState.recoverSavedGame();
  isInitialState(recoveredFromLocalStorage);
});

test("3_players_next_step_0_times", () => {
  let g = new GameState();
  g.players[2] = "player3";
  g.start();
  //g.nextStep();
  expect(g.state.id).toBe("red");
  expect(g.driver).toBe(0);
  expect(g.navigator).toBe(1);
  expect(g.iterations[0].phase).toBe(TDDPhase.RED);
});

test("3_players_next_step_1_times", () => {
  let g = new GameState();
  g.players[2] = "player3";
  g.start();
  g.nextStep();
  expect(g.state.id).toBe("swap");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(2);
  expect(g.iterations[0].phase).toBe(TDDPhase.GREEN);
});

test("3_players_next_step_2_times", () => {
  let g = new GameState();
  g.players[2] = "player3";
  console.log(g.players);
  console.log(g.players.length);
  g.start();
  [...Array(2)].forEach((_) => g.nextStep());
  expect(g.state.id).toBe("green");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(2);
  expect(g.iterations[0].phase).toBe(TDDPhase.GREEN);
});

test("3_players_next_step_3_times", () => {
  let g = new GameState();
  g.players[2] = "player3";
  console.log(g.players);
  console.log(g.players.length);
  g.start();
  [...Array(3)].forEach((_) => g.nextStep());
  expect(g.state.id).toBe("refactor");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(2);
  expect(g.iterations[0].phase).toBe(TDDPhase.REFACTOR);
});

test("3_players_next_step_4_times", () => {
  let g = new GameState();
  g.players[2] = "player3";
  console.log(g.players);
  console.log(g.players.length);
  g.start();
  [...Array(4)].forEach((_) => g.nextStep());
  expect(g.state.id).toBe("red");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(2);
  expect(g.iterations[1].phase).toBe(TDDPhase.RED);
});

test("3_players_next_step_5_times", () => {
  let g = new GameState();
  g.players[2] = "player3";
  console.log(g.players);
  console.log(g.players.length);
  g.start();
  [...Array(5)].forEach((_) => g.nextStep());
  expect(g.state.id).toBe("swap");
  expect(g.driver).toBe(2);
  expect(g.navigator).toBe(0);
  expect(g.iterations[1].phase).toBe(TDDPhase.GREEN);
});

test("3_players_next_step_9_times", () => {
  let g = new GameState();
  g.players[0] = "player0";
  g.players[1] = "player1";
  g.players[2] = "player2";
  console.log(g.players);
  console.log(g.players.length);
  g.start();
  [...Array(9)].forEach((_) => g.nextStep());
  expect(g.state.id).toBe("swap");
  expect(g.driver).toBe(0);
  expect(g.navigator).toBe(1);
  expect(g.iterations[2].phase).toBe(TDDPhase.GREEN);
  const step = g.getStep();
  expect(step.navigators.length).toEqual(2);
  expect(step.navigators).toContainEqual("player1");
  expect(step.navigators).toContainEqual("player2");
});

test("3_players_next_step_13_times", () => {
  let g = new GameState();
  g.players[0] = "player0";
  g.players[1] = "player1";
  g.players[2] = "player2";
  console.log(g.players);
  console.log(g.players.length);
  g.start();
  [...Array(13)].forEach((_) => g.nextStep());
  expect(g.state.id).toBe("swap");
  expect(g.driver).toBe(1);
  expect(g.navigator).toBe(2);
  expect(g.iterations[3].phase).toBe(TDDPhase.GREEN);
  const step = g.getStep();
  expect(step.navigators.length).toEqual(2);
  expect(step.navigators).toContainEqual("player0");
  expect(step.navigators).toContainEqual("player2");
});

test("initialisation", () => {
  let g = new GameState();
  isInitialState(g);
});

const STEPS_PER_CYCLE = 4;
const steps = (g, n) => [...Array(n)].forEach((_) => g.nextStep());

test("cycles_are_open_ended_and_added_one_at_a_time", () => {
  let g = new GameState();
  g.start();
  steps(g, STEPS_PER_CYCLE * 20);
  expect(g.finished).toBe(false);
  expect(g.iterations.length).toBe(21);
  expect(g.iterations[20]).toEqual({ index: 21, phase: TDDPhase.RED, backToRed: 0 });
  expect(g.iterations.slice(0, 20).every((i) => i.phase == TDDPhase.COMPLETED)).toBe(true);
  expect(g.getStep().cycle).toBe(21);
});

test("finish_ends_the_game_and_completes_the_current_cycle", () => {
  let g = new GameState();
  g.start();
  steps(g, STEPS_PER_CYCLE + 3); // refactor of cycle 2
  g.finish();
  expect(g.finished).toBe(true);
  expect(g.getStep()).toBeNull();
  expect(g.iterations.length).toBe(2);
  expect(g.completedCycles()).toBe(2);
});

test("next_step_after_finish_does_nothing", () => {
  let g = new GameState();
  g.start();
  steps(g, 3);
  g.finish();
  const stepNumber = g.stepNumber;
  steps(g, 3);
  g.backToRed();
  expect(g.stepNumber).toBe(stepNumber);
});

test("recover_finished_game_from_local_storage", () => {
  let g = new GameState();
  g.start();
  steps(g, 3);
  g.finish();
  const recovered = GameState.recoverSavedGame();
  expect(recovered.finished).toBe(true);
  expect(recovered.getStep()).toBeNull();
});

test("back_to_red_keeps_driver_and_cycle", () => {
  let g = new GameState();
  g.start();
  steps(g, 2); // green, Jane driving
  g.backToRed();
  expect(g.state.id).toBe("red");
  expect(g.players[g.driver]).toBe("Jane");
  expect(g.iteration).toBe(0);
  expect(g.iterations).toEqual([{ index: 1, phase: TDDPhase.RED, backToRed: 1 }]);
  expect(g.stepNumber).toBe(4);
});

test("back_to_red_from_refactor_then_carries_on_with_a_swap", () => {
  let g = new GameState();
  g.start();
  steps(g, 3); // refactor, Jane driving
  g.backToRed();
  g.nextStep();
  expect(g.state.id).toBe("swap");
  expect(g.players[g.driver]).toBe("John");
  expect(g.iterations.length).toBe(1);
  expect(g.iterations[0].phase).toBe(TDDPhase.GREEN);
});

test("back_to_red_is_ignored_on_red_and_swap", () => {
  let g = new GameState();
  g.start();
  g.backToRed();
  expect(g.stepNumber).toBe(1);
  g.nextStep();
  g.backToRed();
  expect(g.state.id).toBe("swap");
  expect(g.iterations[0].backToRed).toBe(0);
});

test("back_to_red_restores_the_snapshot_from_before_the_red", () => {
  let g = new GameState();
  g.start();
  g.setBaseline("start");
  g.setBefore("after red");
  steps(g, 2); // green
  g.setBefore("after green");
  g.nextStep(); // refactor
  g.backToRed();
  expect(g.before).toBe("start");

  g.setBefore("after refactor");
  steps(g, 4); // through swap, green, refactor into the next red
  expect(g.redBefore).toBe("after refactor");
});

test("overrides_are_counted_and_saved", () => {
  let g = new GameState();
  g.start();
  g.override();
  g.override();
  expect(g.overrides).toBe(2);
  expect(GameState.recoverSavedGame().overrides).toBe(2);
});

test("history_keeps_the_last_few_verdicts", () => {
  let g = new GameState();
  g.start();
  for (let i = 0; i < HISTORY_LENGTH + 2; i++) g.addHistory("red", { decision: "advance", note: "n" + i, extra: 1 });
  expect(g.history.length).toBe(HISTORY_LENGTH);
  expect(g.history[0]).toEqual({ phase: "red", decision: "advance", note: "n2" });
  expect(GameState.recoverSavedGame().history).toEqual(g.history);
});

test("settings_default_and_are_saved", () => {
  let g = new GameState();
  expect(g.enforceRules).toBe(true);
  expect(g.problem).toBe("");
  g.enforceRules = false;
  g.problem = "A stack";
  g.start();
  const recovered = GameState.recoverSavedGame();
  expect(recovered.enforceRules).toBe(false);
  expect(recovered.problem).toBe("A stack");
});

test("snapshots_are_saved", () => {
  let g = new GameState();
  g.start();
  const snapshot = { tests: [{ name: "A.b", status: "failed" }], build: null, runTime: 1, files: [] };
  g.setBaseline(snapshot);
  const recovered = GameState.recoverSavedGame();
  expect(recovered.before).toEqual(snapshot);
  expect(recovered.redBefore).toEqual(snapshot);
});

test("steps_have_no_fizzbuzz_goal", () => {
  let g = new GameState();
  g.start();
  expect(g.getStep().goal).toBeUndefined();
  expect(g.getStep().totalIterations).toBeUndefined();
});

test("generic_hints_for_each_checked_phase", () => {
  for (const phase of ["red", "green", "refactor"]) {
    expect(hintFor(phase, 1)).toBe(phaseHints[phase][0]);
    expect(hintFor(phase, phaseHints[phase].length + 1)).toBe(phaseHints[phase][0]);
    expect(hintFor(phase, 2)).not.toBe(hintFor(phase, 1));
  }
  expect(hintFor("swap", 1)).toBe("");
  expect(hintFor(undefined)).toBe("");
});

test("steps_have_navigator_prompt_except_swap", () => {
  let g = new GameState();
  g.start();
  expect(g.getStep().navigatorPrompt).not.toBe("");
  g.nextStep();
  expect(g.getStep().navigatorPrompt).toBe("");
  g.nextStep();
  expect(g.getStep().navigatorPrompt).not.toBe("");
  g.nextStep();
  expect(g.getStep().navigatorPrompt).not.toBe("");
});

test("player_numbers_follow_roles", () => {
  let g = new GameState();
  g.players[2] = "player3";
  g.start();
  expect(g.getStep().driverNumber).toBe(1);
  expect(g.getStep().navigatorNumbers).toEqual([2, 3]);
  g.nextStep();
  expect(g.getStep().driverNumber).toBe(2);
  expect(g.getStep().navigatorNumbers).toEqual([1, 3]);
});

test("recovered_game_uses_current_state_text", () => {
  const oldRed = { ...states[0], description: "old text" };
  delete oldRed.navigatorPrompt;
  localStorage.setItem(
    GameState.GAME_STATE,
    JSON.stringify({ players: ["a", "b"], state: oldRed, iterations: [] })
  );
  const recovered = GameState.recoverSavedGame();
  expect(recovered.state).toBe(states[0]);
});

test("recover_game_saved_before_finish_existed", () => {
  localStorage.setItem(
    GameState.GAME_STATE,
    JSON.stringify({ players: ["a", "b"], state: states[0], iterations: [] })
  );
  const recovered = GameState.recoverSavedGame();
  expect(recovered.finished).toBe(false);
  expect(recovered.overrides).toBe(0);
  expect(recovered.enforceRules).toBe(true);
  expect(recovered.before).toBeNull();
  expect(recovered.history).toEqual([]);
});

test("recover_game_saved_with_fixed_iterations", () => {
  // the old format laid out cycles four at a time, with a total
  localStorage.setItem(
    GameState.GAME_STATE,
    JSON.stringify({
      players: ["a", "b"],
      driver: 1,
      navigator: 0,
      state: { id: "green", helpName: "code" },
      stepNumber: 7,
      iteration: 1,
      started: true,
      iterations: [
        { phase: 4, index: 1 },
        { phase: 2, index: 2 },
        { phase: 0, index: 3 },
        { phase: 0, index: 4 },
      ],
      totalIterations: 9,
      finished: false,
    })
  );
  const g = GameState.recoverSavedGame();
  expect(g.iterations).toEqual([
    { phase: 4, index: 1, backToRed: 0 },
    { phase: 2, index: 2, backToRed: 0 },
  ]);
  expect(g.getStep().stateName).toBe("green");
  expect(g.getStep().cycle).toBe(2);
  steps(g, 2); // refactor, then the next cycle's red
  expect(g.iterations.length).toBe(3);
  expect(g.iterations[2]).toEqual({ index: 3, phase: TDDPhase.RED, backToRed: 0 });
});

test("recover_game_with_unknown_state_starts_on_red", () => {
  localStorage.setItem(
    GameState.GAME_STATE,
    JSON.stringify({ players: ["a", "b"], state: { id: "gone" }, iterations: [] })
  );
  expect(GameState.recoverSavedGame().state).toBe(states[0]);
});

test("unreadable_save_is_ignored", () => {
  localStorage.setItem(GameState.GAME_STATE, "{not json");
  expect(GameState.recoverSavedGame()).toBeNull();
});