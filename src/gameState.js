import { fizzbuzzGoals } from "./content/fizzbuzzGoals.js";

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

// must match the number of <article id="loopN"> in public/content/fizzbuzz.html
export const TOTAL_ITERATIONS = 9;

export class GameState {
  constructor(recoveredSavedGame) {
    if (recoveredSavedGame) {
      const r = recoveredSavedGame;
      this.players = r.players;
      this.driver = r.driver;
      this.navigator = r.navigator;
      // look up by id so saved games pick up text changes in states
      this.state = states.find((s) => s.id == r.state?.id) || r.state;
      this.stepNumber = r.stepNumber;
      this.iteration = r.iteration;
      this.started = r.started;
      this.iterations = r.iterations;
      this.totalIterations = r.totalIterations || TOTAL_ITERATIONS;
      this.finished = r.finished || false;
    } else {
      (this.players = ["John", "Jane"]),
        (this.driver = 0),
        (this.navigator = 1),
        (this.state = states[0]),
        (this.stepNumber = 1),
        (this.iteration = 0),
        (this.started = false);
      this.iterations = [];
      this.totalIterations = TOTAL_ITERATIONS;
      this.finished = false;
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

  #get4Iterations = (idx) => {
    const its = [
      { phase: 1, index: idx++ },
      { phase: 0, index: idx++ },
      { phase: 0, index: idx++ },
      { phase: 0, index: idx++ },
    ];
    return its.slice(0, this.totalIterations - this.iterations.length);
  };

  static GAME_STATE = "GAME_STATE";

  #save = () => {
    localStorage.setItem(GameState.GAME_STATE, JSON.stringify(this));
  };

  static recoverSavedGame = () => {
    var ls = localStorage.getItem(GameState.GAME_STATE);
    return ls ? new GameState(JSON.parse(ls)) : null;
  };

  start() {
    this.started = true;
    this.iterations = this.#get4Iterations(1);
    this.#save();
  }

  nextStep() {
    if (!this.state) {
      console.log("Error: next step called but no state");
    }
    if (this.finished) return;

    const lastIteration = this.iteration + 1 >= this.totalIterations;
    if (states[this.state.next].id == "red" && lastIteration) {
      this.iterations[this.iteration].phase = TDDPhase.COMPLETED;
      this.finished = true;
      this.#save();
      return;
    }

    this.state = states[this.state.next];
    this.stepNumber++;

    if (this.state.id == "red") {
      this.iterations[this.iteration].phase = TDDPhase.COMPLETED;
      this.iteration++;

      if (this.iteration >= this.iterations.length) {
        const its = this.#get4Iterations(this.iterations.length + 1);
        this.iterations = [...this.iterations, ...its];
      }

      this.iterations[this.iteration].phase = TDDPhase.RED;
    }

    if (this.state.id == "green") {
      this.iterations[this.iteration].phase = TDDPhase.GREEN;
    }
    if (this.state.id == "refactor") {
      this.iterations[this.iteration].phase = TDDPhase.REFACTOR;
    }
    if (this.state.id == "swap") {
      this.iterations[this.iteration].phase = TDDPhase.GREEN;
      this.#swapPairRoles();
    }
    this.#save();
  }

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
      goal: this.state.id == "red" ? fizzbuzzGoals[this.iteration] || "" : "",
      iteration: this.iteration,
      totalIterations: this.totalIterations,
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

// export const resetGame = () => {
//     const gs = copyOfInitialGameState();
//     _gameState.set(gs);
//     localStorage.setItem(GAME_STATE, JSON.stringify(gs))
// }
// const GAME_STATE = "GAME_STATE";
// const copyOfInitialGameState = () => JSON.parse(JSON.stringify(initialGameState));

// export const _gameState = writable(
//     localStorage[GAME_STATE]
//         ? JSON.parse(localStorage[GAME_STATE])
//         : copyOfInitialGameState());
