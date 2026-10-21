export const states = [
  {
    id: "red",
    title: "Make it Red",
    class: "red",
    next: 1,
    description:
      "Write the simplest test you can think of that will fail, then run the test. [Hint: the test you are thinking about is probably too complex]",
    navigatorPrompt:
      "Before the driver types, say out loud what behaviour this test should check.",
    buttonText: "Done: There is ONE failing (red) test",
  },
  {
    id: "swap",
    title: "Swap",
    class: "swap",
    next: 2,
    description: "Swap the roles of driver and navigator",
    navigatorPrompt: "",
    buttonText: "",
  },
  {
    id: "green",
    title: "Make it Green",
    class: "green",
    next: 3,
    description: "Write just enough code to make the failing test pass",
    navigatorPrompt:
      "Watch for code the test doesn't need. Speak up if the driver writes more than that.",
    buttonText: "Done: All the test are now passing (green)",
  },
  {
    id: "refactor",
    title: "Make it Clean",
    class: "refactor",
    next: 0,
    description: "Clean up the code you've just written",
    navigatorPrompt:
      "Point out one piece of duplication or unclear naming, or agree there's nothing worth changing yet.",
    buttonText: "Done: The code is better and all tests are still passing!",
  },
];

export const TDDPhase = {
  COMPLETED: 4,
  GREEN: 2,
  REFACTOR: 3,
  RED: 1,
};

export const HISTORY_LENGTH = 5; // verdicts sent back to the coach as context
export const RESCUE_AFTER = 3; // held this many times on one step: offer to show the code

// What the "stuck" button offers: "show" (ask the coach for the code),
// "teacher" (no coach: ask your teacher), or "" (not stuck yet).
export const rescueOffer = (attempts, coached) => (attempts < RESCUE_AFTER ? "" : coached ? "show" : "teacher");

const newCycle = (index) => ({ phase: TDDPhase.RED, index, backToRed: 0 });

// Identifies one game in the progress records on the coach server.
export function newGameId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // randomUUID needs a secure context; fall through
  }
  return "g-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// Cycles are open-ended: one Red, Swap, Green, Refactor loop per entry in
// `iterations`, added as the pair reaches it, until they choose to finish.
export class GameState {
  constructor(recoveredSavedGame) {
    if (recoveredSavedGame) {
      const r = recoveredSavedGame;
      this.players = r.players;
      this.driver = r.driver ?? 0;
      this.navigator = r.navigator ?? 1;
      // look up by id so saved games pick up text changes in states
      this.state = states.find((s) => s.id == r.state?.id) || states[0];
      this.stepNumber = r.stepNumber ?? 1;
      this.iteration = r.iteration ?? 0;
      this.started = r.started ?? false;
      // games saved before cycles were open-ended had 4 cycles laid out ahead
      this.iterations = (r.iterations || [])
        .slice(0, this.iteration + 1)
        .map((i) => ({ ...i, backToRed: i.backToRed || 0 }));
      this.finished = r.finished || false;
      this.overrides = r.overrides || 0;
      this.enforceRules = r.enforceRules ?? true;
      this.problem = r.problem || "";
      this.before = r.before || null;
      this.redBefore = r.redBefore || null;
      this.history = r.history || [];
      // games saved before the start check existed were already under way
      this.startChecked = r.startChecked ?? true;
      // games started before progress was recorded get an id now
      this.gameId = r.gameId || (this.started ? newGameId() : null);
      this.stuckAttempts = r.stuckAttempts || 0;
      this.rescues = r.rescues || 0;
      this.pendingEvents = r.pendingEvents || [];
      this.nextSteps = r.nextSteps || null;
      this.passedFirst = r.passedFirst || 0;
      this.skipGreen = r.skipGreen || false;
      this.struggle = r.struggle || null;
      this.brief = r.brief || null;
    } else {
      this.players = ["John", "Jane"];
      this.driver = 0;
      this.navigator = 1;
      this.state = states[0];
      this.stepNumber = 1;
      this.iteration = 0;
      this.started = false;
      this.iterations = [];
      this.finished = false;
      this.overrides = 0; // times the pair progressed despite the advice
      this.enforceRules = true; // hold the pair on rule findings, even without the coach
      this.problem = ""; // what the pair is building, from the start screen
      this.before = null; // helper snapshot at the last satisfied Done
      this.redBefore = null; // snapshot when this cycle's Red began, restored by backToRed
      this.history = []; // last few coach verdicts, [{phase, decision, note}]
      this.startChecked = false; // whether this Red's starting code has been checked (rules.startState)
      this.gameId = null; // set by start()
      this.stuckAttempts = 0; // Done/Ask again that ended held, on this step (see noteHeld)
      this.rescues = 0; // times the pair asked to be shown the code
      this.pendingEvents = []; // events for the coach server not yet acknowledged
      this.nextSteps = null; // the coach's last next-steps answer: {stepNumber, steps, extra, extra_needed}
      this.passedFirst = 0; // Red tests kept although they passed straight away
      this.skipGreen = false; // this cycle's Red test passed first time and was kept: no Green
      this.struggle = null; // this step's struggle signals (see struggleFor), started lazily
      this.brief = null; // the coach's Orient reading: {building, code_state, warnings, first_move}
    }
    this.#save();
  }

  #swapPairRoles = () => {
    this.driver++;
    this.navigator++;
    const numInMob = this.players.length;
    this.driver %= numInMob;
    this.navigator %= numInMob;
  };

  static GAME_STATE = "GAME_STATE";

  #save = () => {
    try {
      localStorage.setItem(GameState.GAME_STATE, JSON.stringify(this));
    } catch {
      // storage full (big source files in the snapshot) or blocked; the game still works
    }
  };

  static recoverSavedGame = () => {
    try {
      const ls = localStorage.getItem(GameState.GAME_STATE);
      return ls ? new GameState(JSON.parse(ls)) : null;
    } catch {
      return null; // unreadable save: start a new game
    }
  };

  start() {
    this.started = true;
    this.iterations = [newCycle(1)];
    this.startChecked = false;
    this.gameId = newGameId();
    this.#save();
  }

  nextStep() {
    if (this.finished) return;

    this.state = states[this.state.next];
    // a Red test kept although it passed first time has nothing to make pass:
    // after the Swap, straight to Refactor
    if (this.state.id == "green" && this.skipGreen) {
      this.state = states.find((s) => s.id == "refactor");
      this.skipGreen = false;
    }
    this.stepNumber++;
    this.stuckAttempts = 0; // moving on: no longer stuck
    const cycle = this.iterations[this.iteration];

    if (this.state.id == "red") {
      this.redBefore = this.before;
      this.startChecked = false;
      cycle.phase = TDDPhase.COMPLETED;
      this.iteration++;
      this.iterations.push(newCycle(this.iteration + 1));
    }
    if (this.state.id == "swap") {
      cycle.phase = TDDPhase.GREEN;
      this.#swapPairRoles();
    }
    if (this.state.id == "green") cycle.phase = TDDPhase.GREEN;
    if (this.state.id == "refactor") cycle.phase = TDDPhase.REFACTOR;
    this.#save();
  }

  // The coach sends the pair back to write a (better) test: same driver,
  // same cycle, no swap. The rules compare with the code from before the
  // cycle's Red again, so a rewritten test still counts as the one new test.
  backToRed() {
    if (this.finished || !["green", "refactor"].includes(this.state.id)) return;
    this.before = this.redBefore;
    this.startChecked = true; // the failing test is theirs: no need to check where they start
    this.state = states[0];
    this.stepNumber++;
    const cycle = this.iterations[this.iteration];
    cycle.phase = TDDPhase.RED;
    cycle.backToRed++;
    this.#save();
  }

  finish() {
    if (this.finished) return;
    if (this.iterations[this.iteration]) this.iterations[this.iteration].phase = TDDPhase.COMPLETED;
    this.finished = true;
    this.#save();
  }

  // A Done or Ask again on this step that ended held (a rule hold or a coach
  // redo or back to Red). Kept through a back to Red, which isn't progress;
  // reset by nextStep. At RESCUE_AFTER the pair is offered the code.
  noteHeld() {
    this.stuckAttempts++;
    this.#save();
  }

  // How much the pair is struggling on this step, for the hint ladder (ladder.js)
  // and the coach: {step, startedAt, run, lines, runs, moreHelp, shown}. Started
  // the first time it's asked for on a step, so a new step starts afresh.
  struggleFor(stepNumber, now = Date.now() / 1000) {
    if (this.struggle?.step !== stepNumber) {
      this.struggle = { step: stepNumber, startedAt: now, run: null, lines: null, runs: 0, moreHelp: 0, shown: 0 };
      this.#save();
    }
    return this.struggle;
  }

  // A fresh run (or build) on this step: with the live goal lines unchanged
  // since the last one, it's a run without progress; any change starts the count again.
  noteRun(stepNumber, run, lines, now = Date.now() / 1000) {
    const s = this.struggleFor(stepNumber, now);
    if (s.run === run) return;
    s.runs = s.run !== null && s.lines === lines ? s.runs + 1 : 0;
    s.run = run;
    s.lines = lines;
    this.#save();
  }

  // "More help": one rung up on this step.
  noteMoreHelp(stepNumber) {
    this.struggleFor(stepNumber).moreHelp++;
    this.#save();
  }

  // The pair now sees rung `rung` of a hold. The teacher's record counts rungs 2 and 3.
  noteHintShown(stepNumber, rung) {
    const s = this.struggleFor(stepNumber);
    if (rung <= s.shown) return;
    s.shown = rung;
    if (rung >= 2) this.addEvent("hint", `rung ${rung}`);
    this.#save();
  }

  // The struggle signals sent with every Look (DESIGN-coach-flow.md section 6).
  struggleSignals(stepNumber, { novice = false, rung = 1 } = {}, now = Date.now() / 1000) {
    const s = this.struggleFor(stepNumber, now);
    return {
      runs_without_progress: s.runs,
      minutes_on_step: Math.max(0, Math.floor((now - s.startedAt) / 60)),
      holds_on_step: this.stuckAttempts,
      hints_shown: s.shown,
      novice: !!novice,
      rung,
    };
  }

  // The coach's last Look for one step: its guidance (steps, extra) and its
  // verdict, with the key of the code and results it saw (coach.lookKey) and
  // whether a Done has used it yet. Ignored once the pair has moved on
  // (nextStepsFor checks the step number), so nothing needs clearing.
  setNextSteps(stepNumber, answer, { key = "", used = false } = {}) {
    this.nextSteps = {
      stepNumber,
      steps: answer.steps || [],
      extra: answer.extra || "",
      extra_needed: !!answer.extra_needed,
      verdict: answer.decision ? answer : null,
      key,
      used,
    };
    this.#save();
  }

  // A Done reused the cached Look's verdict: each Look is reused at most once.
  markLookUsed() {
    if (this.nextSteps) this.nextSteps.used = true;
    this.#save();
  }

  nextStepsFor = (stepNumber) => (this.nextSteps?.stepNumber === stepNumber ? this.nextSteps : null);

  // "Keep it: the code already does this": this Red's test passed straight
  // away and the pair keeps it. Recorded for the teacher; the cycle then skips
  // Green (see nextStep). Call before moving on from Red.
  keepPassingTest(name) {
    if (this.state.id != "red") return;
    this.passedFirst++;
    this.skipGreen = true;
    this.addEvent("passed_first_time", name);
  }

  // The coach's Orient reading of the code (DESIGN-coach-flow.md 3A), kept for
  // the game: its `building` goes with every later call. A re-read ("Read my
  // code again") is an `orient` event for the teacher; the first reading isn't.
  setBrief(brief, { reread = false } = {}) {
    this.brief = {
      building: String(brief?.building || "").trim(),
      code_state: brief?.code_state || "",
      warnings: Array.isArray(brief?.warnings) ? brief.warnings : [],
      first_move: String(brief?.first_move || "").trim(),
    };
    if (reread) this.addEvent("orient", this.brief.building);
    this.#save();
  }

  // "Not quite": the pair's own words replace what the coach thought they're building.
  editBuilding(text) {
    const building = String(text || "").trim();
    if (!building) return;
    this.brief = { ...(this.brief || { code_state: "", warnings: [], first_move: "" }), building, edited: true };
    this.addEvent("orient", building);
    this.#save();
  }

  // The pair asked to be shown the code for this step.
  noteRescue(why) {
    this.rescues++;
    this.addEvent("rescue", (why || "").split("\n")[0]);
  }

  // Something worth recording for the teacher; sent with the next progress
  // report and kept until the server has it (see ackEvents).
  addEvent(kind, detail = "") {
    this.pendingEvents = [
      ...this.pendingEvents,
      {
        t: Math.floor(Date.now() / 1000),
        kind,
        phase: this.finished ? "finished" : this.state.id,
        cycle: this.iteration + 1,
        detail: String(detail).slice(0, 500),
      },
    ].slice(-50); // a long offline spell keeps only the latest
    this.#save();
  }

  // The server stored the first `count` pending events.
  ackEvents(count) {
    this.pendingEvents = this.pendingEvents.slice(count);
    this.#save();
  }

  override() {
    this.overrides++;
    this.#save();
  }

  setBefore(snapshot) {
    this.before = snapshot;
    this.#save();
  }

  // The code as a Red starts: taken ONCE, when this Red's start check first
  // passes, and never again while the same Red is live, even if the live
  // start state flips back to clean (say the pair makes their test pass
  // again). Returns whether it was taken now.
  takeBaseline(snapshot) {
    if (this.startChecked) return false;
    this.before = this.redBefore = snapshot;
    this.startChecked = true;
    this.#save();
    return true;
  }

  markStartChecked() {
    this.startChecked = true;
    this.#save();
  }

  addHistory(phase, verdict) {
    this.history = [...this.history, { phase, decision: verdict.decision, note: verdict.note || "" }].slice(
      -HISTORY_LENGTH
    );
    this.#save();
  }

  // Cycles finished, counting the current one only when the game is finished.
  completedCycles = () => this.iterations.filter((i) => i.phase == TDDPhase.COMPLETED).length;

  backToRedCount = () => this.iterations.reduce((sum, i) => sum + (i.backToRed || 0), 0);

  // What the coach server records after each step, for grading.
  progress = () => ({
    game_id: this.gameId,
    pair: this.players.filter((p) => p),
    problem: this.problem,
    steps: this.stepNumber - 1, // every step change: advances (Swap included) and backs to Red
    cycles: this.completedCycles(),
    phase: this.finished ? "finished" : this.state.id,
    overrides: this.overrides,
    back_to_red: this.backToRedCount(),
    finished: this.finished,
    rescues: this.rescues,
    passed_first: this.passedFirst,
    events: this.pendingEvents.slice(0, 10), // acknowledged with ackEvents once sent
  });

  #driver = () => this.players[this.driver];
  #navigator = () => this.players[this.navigator];
  #navigators = () =>
    this.players.filter((player, index) => index != this.driver);
  // player numbers start at 1, matching the --player-N colours in global.css
  #navigatorNumbers = () =>
    this.players
      .map((player, index) => index + 1)
      .filter((number) => number - 1 != this.driver);

  #navigatorText = () => {
    if (this.#navigators().length == 1)
      return this.#navigators()[0] + " is the navigator";

    return this.#navigators().join(" and ") + " are the navigators";
  };

  getStep = () => {
    if (this.finished) return null;

    const step = {
      title: "Step:" + this.stepNumber + " " + this.state.title,
      bodyText: this.state.description,
      buttonText: this.state.buttonText,
      classes: "" + this.state.class + " step",
      driver: this.#driver(),
      navigator: this.#navigator(),
      navigators: this.#navigators(),
      driverNumber: this.driver + 1,
      navigatorNumbers: this.#navigatorNumbers(),
      navigatorPrompt: this.state.navigatorPrompt || "",
      cycle: this.iteration + 1,
      stepNumber: this.stepNumber,
      stateName: this.state.id,
    };

    if (this.state.id == "swap") {
      step.title = "Swap pair programming roles";
      step.bodyText =
        this.#driver() + " is now the driver and " + this.#navigatorText();

      step.buttonText = "OK:" + this.#driver() + " has the keyboard";
      step.classes = "" + this.state.class + " swap step"; //TODO is this redundant?
    }
    return step;
  };
}
