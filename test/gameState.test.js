import { GameState, states, TDDPhase } from "../src/gameState";

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
  expect(g.iterations.length).toBe(4);
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
  expect(step.iteration).toBe(0);
  expect(step.driver).toBe("John");
});

test("get_step_after_1_nexts", () => {
  let g = new GameState();
  g.start();
  g.nextStep();
  const step = g.getStep();
  expect(step.stateName).toBe("swap");
  expect(step.iteration).toBe(0);
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
  expect(step.iteration).toBe(0);
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
  expect(step.iteration).toBe(0);
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