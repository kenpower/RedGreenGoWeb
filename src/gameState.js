export const states = [
  {
    id: "red",
    title: "Make it Red",
    helpName: "test",
    class: "red",
    next: 1,
    description: "Write the simplest test you can think of that will fail",
    buttonText: "Done: There is ONE failing (red) test",
  },
  {
    id: "swap",
    title: "Swap",
    helpName: "",
    class: "swap",
    next: 2,
    description: "Swap the roles of driver and navigator",
    buttonText: "",
  },
  {
    id: "green",
    title: "Make it Green",
    helpName: "code",
    class: "green",
    next: 3,
    description: "Write just enough code to make the failing test pass",
    buttonText: "Done: All the test are now passing (green)",
  },
  {
    id: "refactor",
    title: "Make it Clean",
    helpName: "refactor",
    class: "refactor",
    next: 0,
    description: "Clean up the code you've just written",
    buttonText: "Done: The code is better and all tests are still passing!",
  },
];

export const TDDPhase = {
  COMPLETED: 4,
  GREEN: 2,
  REFACTOR: 3,
  RED: 1,
};

export class GameState {
  constructor(recoveredSavedGame) {
    if (recoveredSavedGame) {
      const r = recoveredSavedGame;
      this.players = r.players;
      this.driver = r.driver;
      this.navigator = r.navigator;
      this.state = r.state;
      this.stepNumber = r.stepNumber;
      this.iteration = r.iteration;
      this.started = r.started;
      this.iterations = r.iterations;
    } else {
      (this.players = ["John", "Jane"]),
        (this.driver = 0),
        (this.navigator = 1),
        (this.state = states[0]),
        (this.stepNumber = 1),
        (this.iteration = 0),
        (this.started = false);
      this.iterations = [];
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
    return [
      { phase: 1, index: idx++ },
      { phase: 0, index: idx++ },
      { phase: 0, index: idx++ },
      { phase: 0, index: idx++ },
    ];
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

  #navigatorText = () => {
    if (this.#navigators().length == 1)
      return this.#navigators()[0] + " is the navigator";

    return this.#navigators().join(" and ") + " are the navigators";
  };

  getStep = () => {
    const step = {
      title: "Step:" + this.stepNumber + " " + this.state.title,
      bodyText: this.state.description,
      buttonText: this.state.buttonText,
      classes: "" + this.state.class + " step",
      helpName: this.state.helpName,
      driver: this.#driver(),
      navigator: this.#navigator(),
      navigators: this.#navigators(),
      iteration: this.iteration,
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
