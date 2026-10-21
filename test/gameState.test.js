import { GameState, states, TDDPhase, HISTORY_LENGTH, newGameId, rescueOffer, RESCUE_AFTER } from "../src/gameState";
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
  g.takeBaseline("start");
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
  g.takeBaseline(snapshot);
  const recovered = GameState.recoverSavedGame();
  expect(recovered.before).toEqual(snapshot);
  expect(recovered.redBefore).toEqual(snapshot);
});

test("stuck_attempts_count_holds_on_one_step_and_reset_when_the_step_advances", () => {
  let g = new GameState();
  g.start();
  g.noteHeld();
  g.noteHeld();
  expect(g.stuckAttempts).toBe(2);
  expect(GameState.recoverSavedGame().stuckAttempts).toBe(2);
  g.nextStep(); // Red done: swap
  expect(g.stuckAttempts).toBe(0);
});

test("a_back_to_red_is_not_progress_so_the_attempts_carry_on", () => {
  let g = new GameState();
  g.start();
  steps(g, 2); // green
  g.noteHeld();
  g.backToRed();
  g.noteHeld();
  g.noteHeld();
  expect(g.stuckAttempts).toBe(3);
});

test("the_code_is_offered_after_three_attempts_and_only_with_the_coach", () => {
  expect(rescueOffer(2, true)).toBe("");
  expect(rescueOffer(RESCUE_AFTER, true)).toBe("show");
  expect(rescueOffer(RESCUE_AFTER + 2, true)).toBe("show");
  // coach off: no code to fetch, just a pointer to the teacher
  expect(rescueOffer(RESCUE_AFTER, false)).toBe("teacher");
  expect(rescueOffer(0, false)).toBe("");
});

test("rescues_are_counted_and_sent_as_events_until_acknowledged", () => {
  let g = new GameState();
  g.start();
  g.noteRescue("This test calls fizzBuzz with 1.\nMore detail.");
  const p = g.progress();
  expect(p.rescues).toBe(1);
  expect(p.events).toHaveLength(1);
  expect(p.events[0]).toMatchObject({ kind: "rescue", phase: "red", cycle: 1, detail: "This test calls fizzBuzz with 1." });
  expect(Number.isInteger(p.events[0].t)).toBe(true);
  expect(GameState.recoverSavedGame().pendingEvents).toHaveLength(1); // survives a reload unsent
  g.ackEvents(1);
  expect(g.progress().events).toEqual([]);
});

test("progress_sends_at_most_ten_events_at_a_time", () => {
  let g = new GameState();
  g.start();
  for (let i = 0; i < 12; i++) g.addEvent("hint", String(i));
  expect(g.progress().events.map((e) => e.detail)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  g.ackEvents(10);
  expect(g.progress().events.map((e) => e.detail)).toEqual(["10", "11"]);
});

test("keeping_a_test_that_passed_first_time_skips_green_but_keeps_the_swap", () => {
  let g = new GameState();
  g.start();
  const driver = g.driver;
  g.keepPassingTest("FizzBuzz.OneIsOne");
  g.nextStep(); // Red done
  expect(g.state.id).toBe("swap");
  expect(g.driver).not.toBe(driver); // roles swap as usual
  g.nextStep(); // Swap done
  expect(g.state.id).toBe("refactor"); // no Green: nothing to make pass
  expect(g.iterations[0].phase).toBe(TDDPhase.REFACTOR);
  expect(g.iteration).toBe(0); // the same cycle
  g.nextStep(); // Refactor done
  expect(g.state.id).toBe("red");
  expect(g.iteration).toBe(1);
  expect(g.completedCycles()).toBe(1);
  // the next cycle has its Green again
  g.nextStep();
  g.nextStep();
  expect(g.state.id).toBe("green");
});

test("a_kept_test_is_counted_and_sent_as_an_event", () => {
  let g = new GameState();
  g.start();
  g.keepPassingTest("FizzBuzz.OneIsOne");
  const p = g.progress();
  expect(p.passed_first).toBe(1);
  expect(p.events.at(-1)).toMatchObject({ kind: "passed_first_time", phase: "red", detail: "FizzBuzz.OneIsOne" });
  expect(GameState.recoverSavedGame().skipGreen).toBe(true); // survives a reload before the swap
});

test("the_last_look_is_cached_per_step_with_its_verdict_and_reused_once", () => {
  let g = new GameState();
  g.start();
  g.setNextSteps(1, { steps: [{ id: "red.run_tests", detail: "" }], extra: "", decision: "redo", note: "n" }, { key: "k1" });
  const look = g.nextStepsFor(1);
  expect(look).toMatchObject({ key: "k1", used: false, steps: [{ id: "red.run_tests", detail: "" }] });
  expect(look.verdict.decision).toBe("redo");
  g.markLookUsed();
  expect(GameState.recoverSavedGame().nextStepsFor(1).used).toBe(true);
  expect(g.nextStepsFor(2)).toBeNull(); // another step: nothing cached
});

test("struggle_signals_count_runs_without_progress_and_minutes_on_the_step", () => {
  let g = new GameState();
  g.start();
  g.struggleFor(1, 1000);
  g.noteRun(1, "run-a", "lines-1", 1000); // the first run seen: nothing to compare yet
  g.noteRun(1, "run-a", "lines-1", 1010); // the same run again: not counted
  g.noteRun(1, "run-b", "lines-1", 1060); // a new run, goal lines unchanged
  g.noteRun(1, "run-c", "lines-1", 1120);
  expect(g.struggleSignals(1, { novice: true, rung: 3 }, 1000 + 6 * 60)).toEqual({
    runs_without_progress: 2,
    minutes_on_step: 6,
    holds_on_step: 0,
    hints_shown: 0,
    novice: true,
    rung: 3,
  });
  g.noteRun(1, "run-d", "lines-2", 1200); // a goal line changed: progress, the count starts again
  expect(g.struggleFor(1).runs).toBe(0);
  g.noteHeld();
  expect(GameState.recoverSavedGame().struggleSignals(1, {}, 1200).holds_on_step).toBe(1);
});

test("more_help_and_the_rungs_shown_are_per_step_and_rungs_2_and_3_are_recorded", () => {
  let g = new GameState();
  g.start();
  g.noteMoreHelp(1);
  g.noteHintShown(1, 1);
  g.noteHintShown(1, 2);
  g.noteHintShown(1, 2); // shown again: recorded once
  g.noteHintShown(1, 3);
  expect(g.struggleFor(1)).toMatchObject({ moreHelp: 1, shown: 3 });
  expect(g.pendingEvents.filter((e) => e.kind === "hint").map((e) => e.detail)).toEqual(["rung 2", "rung 3"]);
  steps(g, 1); // a new step starts afresh
  expect(g.struggleFor(g.stepNumber)).toMatchObject({ moreHelp: 0, shown: 0, runs: 0 });
});

test("the_orient_brief_is_kept_and_edits_and_rereads_are_events_for_the_teacher", () => {
  let g = new GameState();
  g.start();
  g.setBrief({ building: " FizzBuzz. ", code_state: "scaffold", warnings: ["A placeholder test."], first_move: "Test 1." });
  expect(g.brief).toEqual({ building: "FizzBuzz.", code_state: "scaffold", warnings: ["A placeholder test."], first_move: "Test 1." });
  expect(g.pendingEvents.filter((e) => e.kind === "orient")).toEqual([]); // the first reading isn't an event
  g.editBuilding("  A FizzBuzz printer for 1 to 100 ");
  expect(g.brief).toMatchObject({ building: "A FizzBuzz printer for 1 to 100", edited: true, code_state: "scaffold" });
  g.editBuilding("   "); // nothing to save
  g.setBrief({ building: "FizzBuzz, read again.", code_state: "partial", warnings: [], first_move: "" }, { reread: true });
  expect(g.pendingEvents.filter((e) => e.kind === "orient").map((e) => e.detail)).toEqual([
    "A FizzBuzz printer for 1 to 100",
    "FizzBuzz, read again.",
  ]);
  expect(GameState.recoverSavedGame().brief.code_state).toBe("partial");
});

test("recheck_starts_this_step_afresh_without_restarting_the_game", () => {
  let g = new GameState();
  g.start();
  g.takeBaseline("red start");
  g.noteHeld();
  g.noteMoreHelp(1);
  g.setNextSteps(1, { steps: [], decision: "redo", note: "n" }, { key: "k" });
  g.recheck("now");
  // Red: back to its start check, which takes the baseline again
  expect(g.startChecked).toBe(false);
  expect(g.takeBaseline("red again")).toBe(true);
  expect(g.before).toBe("red again");
  expect(g.stuckAttempts).toBe(0);
  expect(g.nextStepsFor(1)).toBeNull();
  expect(g.struggleFor(1).moreHelp).toBe(0);
  expect(g.pendingEvents.filter((e) => e.kind === "recheck").map((e) => e.detail)).toEqual(["red"]);
  expect(g.iteration).toBe(0); // the game goes on: same cycle, same step
  expect(g.stepNumber).toBe(1);

  steps(g, 2); // swap, then green
  g.recheck("green now");
  expect(g.before).toBe("green now"); // Green and Refactor: the code now is the baseline
  steps(g, 1); // refactor
  g.recheck(null);
  expect(g.before).toBe("green now"); // nothing to take: kept
  expect(GameState.recoverSavedGame().pendingEvents.filter((e) => e.kind === "recheck").map((e) => e.detail)).toEqual([
    "red",
    "green",
    "refactor",
  ]);
});

test("the_green_verdicts_smell_goes_to_refactor_and_its_events_are_recorded_once", () => {
  let g = new GameState();
  g.start();
  steps(g, 2); // green
  g.setSmell({ smell_question: "Can you spot the duplication?", smell_detail: "Three ifs repeat 'I'." });
  steps(g, 1); // refactor: the smell comes along
  expect(g.smell).toMatchObject({ question: "Can you spot the duplication?", shown: false });
  g.noteSmell("shown");
  g.noteSmell("shown");
  g.noteSmell("revealed");
  g.noteSmell("nothing to tidy");
  expect(g.pendingEvents.filter((e) => e.kind === "smell").map((e) => e.detail)).toEqual([
    "shown: Can you spot the duplication?",
    "revealed: Three ifs repeat 'I'.",
    "nothing to tidy",
  ]);
  expect(GameState.recoverSavedGame().smell.revealed).toBe(true);
  steps(g, 1); // the next Red: gone
  expect(g.smell).toBeNull();
  g.setSmell({ smell_question: "", smell_detail: "" });
  expect(g.smell).toBeNull(); // no smell from the verdict, nothing to show
});

test("refactor_checkpoint_is_the_green_run_before_the_one_being_looked_at", () => {
  let g = new GameState();
  g.start();
  steps(g, 3); // refactor
  g.setBefore("start of refactor");
  const step = g.stepNumber;
  expect(g.checkpointFor(step, "run1")).toBe("start of refactor"); // nothing green yet: the step's start
  g.noteGreenRun(step, "run1", "green 1");
  expect(g.checkpointFor(step, "run1")).toBe("start of refactor"); // the Look for run 1 compares with before it
  expect(g.checkpointFor(step, "run2")).toBe("green 1"); // a red run 2 compares with the last green
  g.noteGreenRun(step, "run1", "green 1 again"); // the same run: no change
  g.noteGreenRun(step, "run3", "green 3");
  expect(g.checkpointFor(step, "run3")).toBe("green 1");
  expect(GameState.recoverSavedGame().checkpointFor(step, "run4")).toBe("green 3");
  expect(g.checkpointFor(step + 1, "run9")).toBe("start of refactor"); // another step: its own start
});

test("refactor_moves_are_counted_per_refactoring_and_recorded", () => {
  let g = new GameState();
  g.start();
  g.noteMove({ refactoring: "Extract Function", effect: "better", behaviour_kept: true, note: "" });
  g.noteMove({ refactoring: "Extract Function", effect: "same", behaviour_kept: true, note: "" });
  g.noteMove({ refactoring: "", effect: "none", behaviour_kept: true, note: "" }); // nothing changed
  g.noteMove(null);
  expect(g.progress().refactorings).toEqual({ "Extract Function": 2 });
  expect(g.pendingEvents.filter((e) => e.kind === "refactor_move").map((e) => e.detail)).toEqual([
    "Extract Function | better",
    "Extract Function | same",
  ]);
});

test("the_refactor_lab_cycles_refactor_test_commit_and_swaps_after_each_commit", () => {
  let g = new GameState();
  g.startLab(["Extract Function"], { git: { repo: true, head: "aaa" } });
  expect(g.mode).toBe("refactor");
  expect(g.lab).toMatchObject({ phase: "refactor", round: 1, rounds: 0, refactorings: ["Extract Function"] });
  const driver = g.driver;
  g.labDone(null);
  expect(g.lab.phase).toBe("test");
  g.labRun({ red: true, green: false }); // a change broke a test...
  g.labRun({ red: true, green: false });
  g.labRun({ red: false, green: true }); // ...and was undone: one revert
  g.labDone(null);
  expect(g.lab.phase).toBe("commit");
  g.labDone({ git: { repo: true, head: "bbb", headMessage: "Extract Function: priceFor" } });
  expect(g.lab).toMatchObject({ phase: "refactor", round: 2, rounds: 1, commits: 1, reverts: 1 });
  expect(g.lab.base.git.head).toBe("bbb"); // the commit is the next round's base
  expect(g.driver).not.toBe(driver); // roles swapped
  expect(g.pendingEvents.filter((e) => e.kind === "commit").map((e) => e.detail)).toEqual(["bbb Extract Function: priceFor"]);
  const progress = g.progress();
  expect(progress).toMatchObject({ mode: "refactor", rounds: 1, commits: 1, reverts: 1, phase: "refactor" });
  expect(GameState.recoverSavedGame().lab.round).toBe(2);
});

test("the_lab_board_ticks_smells_the_coach_saw_resolved", () => {
  let g = new GameState();
  g.startLab(["Extract Function"], null);
  g.setBoard([{ id: "tax", where: "priceFor", what: "Inline tax.", refactoring: "Extract Function" }]);
  g.labReview({
    smells_resolved: ["tax", "tax", "nope"],
    move_review: { refactoring: "Extract Function", effect: "better", behaviour_kept: true, note: "" },
  });
  expect(g.lab.board[0].resolved).toBe(true);
  expect(g.pendingEvents.filter((e) => e.kind === "smell").map((e) => e.detail)).toEqual(["resolved: Inline tax."]);
  expect(g.refactorings).toEqual({ "Extract Function": 1 });
  expect(GameState.recoverSavedGame().lab.board[0].resolved).toBe(true);
});

test("a_lab_phase_is_reported_as_one_the_server_knows", () => {
  let g = new GameState();
  g.startLab([], null);
  g.labDone(null); // test
  expect(g.progress().phase).toBe("refactor");
  g.addEvent("hint", "x");
  expect(g.pendingEvents[g.pendingEvents.length - 1].phase).toBe("refactor");
});

test("keep_only_works_on_red", () => {
  let g = new GameState();
  g.start();
  steps(g, 2); // green
  g.keepPassingTest("X.y");
  expect(g.passedFirst).toBe(0);
  expect(g.skipGreen).toBe(false);
});

test("the_red_baseline_is_taken_once_per_red_even_if_the_start_turns_clean_again", () => {
  let g = new GameState();
  g.start();
  expect(g.takeBaseline("passing at the start")).toBe(true);
  // the pair makes their test fail, then pass again: the start check sees
  // "clean" again, but the baseline stays the one from the start of this Red
  expect(g.takeBaseline("passing again")).toBe(false);
  expect(g.before).toBe("passing at the start");
  expect(GameState.recoverSavedGame().redBefore).toBe("passing at the start");
  steps(g, 4); // swap, green, refactor, the next red
  expect(g.takeBaseline("next red")).toBe(true);
});

test("start_check_is_due_at_each_red", () => {
  let g = new GameState();
  g.start();
  expect(g.startChecked).toBe(false);
  g.markStartChecked();
  expect(g.startChecked).toBe(true);
  steps(g, 3); // swap, green, refactor
  expect(g.startChecked).toBe(true);
  g.nextStep(); // next red
  expect(g.startChecked).toBe(false);
  expect(GameState.recoverSavedGame().startChecked).toBe(false);
});

test("back_to_red_skips_the_start_check", () => {
  let g = new GameState();
  g.start();
  g.markStartChecked();
  steps(g, 2);
  g.backToRed();
  expect(g.startChecked).toBe(true);
});

test("games_saved_before_the_start_check_count_as_checked", () => {
  localStorage.setItem(
    GameState.GAME_STATE,
    JSON.stringify({ players: ["a", "b"], state: states[0], iterations: [], started: true })
  );
  expect(GameState.recoverSavedGame().startChecked).toBe(true);
});

test("start_creates_a_saved_game_id", () => {
  let g = new GameState();
  expect(g.gameId).toBeNull();
  g.start();
  expect(typeof g.gameId).toBe("string");
  expect(g.gameId.length).toBeGreaterThan(8);
  expect(GameState.recoverSavedGame().gameId).toBe(g.gameId);
  const other = new GameState();
  other.start();
  expect(other.gameId).not.toBe(g.gameId);
});

test("game_id_falls_back_without_randomUUID", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
  try {
    expect(newGameId()).toMatch(/^g-/);
    expect(newGameId()).not.toBe(newGameId());
  } finally {
    if (original) Object.defineProperty(globalThis, "crypto", original);
    else delete globalThis.crypto;
  }
});

test("a_game_started_before_ids_existed_gets_one_on_recovery", () => {
  localStorage.setItem(
    GameState.GAME_STATE,
    JSON.stringify({ players: ["a", "b"], state: states[0], iterations: [], started: true })
  );
  const g = GameState.recoverSavedGame();
  expect(typeof g.gameId).toBe("string");
});

test("progress_summarises_the_game", () => {
  let g = new GameState();
  g.players = ["Jane", "John", ""];
  g.problem = "A stack";
  g.start();
  expect(g.progress()).toEqual({
    game_id: g.gameId,
    pair: ["Jane", "John"],
    problem: "A stack",
    steps: 0,
    cycles: 0,
    phase: "red",
    overrides: 0,
    back_to_red: 0,
    finished: false,
    rescues: 0,
    passed_first: 0,
    refactorings: {},
    mode: "tdd",
    events: [],
  });

  steps(g, 2); // swap, green
  g.backToRed();
  g.override();
  steps(g, 4); // swap, green, refactor, next red
  expect(g.progress()).toMatchObject({ steps: 7, cycles: 1, phase: "red", overrides: 1, back_to_red: 1 });

  g.finish();
  expect(g.progress()).toMatchObject({ steps: 7, cycles: 2, phase: "finished", finished: true });
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