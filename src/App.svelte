<script>
  import Game from "./components/Game.svelte";
  //import {gameState} from './store.js';
  //import {reStartGame, startGame} from './gameLogic.js';
  import { GameState } from "./gameState";
  import { fly } from "svelte/transition";
  import HelperStatus from "./components/HelperStatus.svelte";
  import { startHelper, resetHelper } from "./helper.js";
  import { startCoach, resetCoach, getClassCode, setClassCode } from "./coach.js";

  startHelper();
  startCoach();

  let thirdPlayer;
  let classCode = getClassCode();
  let gameState = GameState.recoverSavedGame();
  if (!gameState) {
    gameState = new GameState();
  }
  const startGame = () => {
    if (thirdPlayer) gameState.players[2] = thirdPlayer;
    setClassCode(classCode);
    gameState.start();
    gameState = gameState;
  };

  const reStartGame = () => {
    gameState = new GameState();
    resetHelper();
    resetCoach();
  };
</script>

<main>
  <header>
    <div>
      <h1 class="title">
        <span id="red">Red</span>-<span id="green">Green</span>-<span id="blue"
          >Go!</span
        >
      </h1>
      <p class="tagline">// a game of TDD &amp; pairing</p>
    </div>
    <nav class="menu">
      <button on:click={reStartGame} title="Restart Game">Restart</button>
      <HelperStatus />
    </nav>
  </header>

  <section>
    {#if gameState.started}
      <div in:fly={{ y: 200, duration: 2000 }}>
        <Game {gameState} on:restart={reStartGame} />
      </div>
    {:else}
      <h2 class="aoc-heading">How to play</h2>
      <p>
        Test Driven Development (TDD) is a process for writing code that
        involves repeatedly appying three distinct steps:
      </p>
      <ol>
        <li>
          <p>
            Describe one very simple thing what your code <strong>should</strong
            >
            do. We write this description in a <em>"test"</em>. A test is a
            special function that can check if a single peice of code does what
            you say it should do.
          </p>
          <p>
            After you write the test, the test will fail, but that is OK as you
            won't have written the code yet.
          </p>
        </li>
        <li>
          The next step is to to write enough code that will make the test pass.
          You don't have to write very much, nor do you have to write clever
          code. You can even hard code in results that will pass the test. The
          code written at this stage will usually be low quality, and specifit
          to the test. But that is ok, we will get a chance to improve the code
          later on. During this step the important thing is to get the test
          passing.
        </li>
        <li>
          Once the test is passing (green), the final step in the cycle is
          refactoring. This is where we look at the code we just wrote and try
          to find patterns that we can use to make the code more general. We
          will repeat these three steps with tests covering more and more of the
          required behaviour.
        </li>
      </ol>
      <div class="setup">
        <h2 class="aoc-heading">Who is playing?</h2>
        <span>
          <label for="name1">Player 1 (required)</label>
          <input
            type="text"
            id="name1"
            name="name1"
            required
            bind:value={gameState.players[0]}
          /><br />
        </span>
        <span>
          <label for="name2">Player 2 (required)</label>
          <input
            type="text"
            id="name2"
            name="name2"
            required
            bind:value={gameState.players[1]}
          /><br />
        </span>
        <span>
          <label for="name3">Player 3 (Optional)</label>
          <input
            type="text"
            id="name3"
            name="name3"
            bind:value={thirdPlayer}
          /><br />
        </span>
        <span>
          <label for="classCode">Class code (Optional)</label>
          <input
            type="text"
            id="classCode"
            name="classCode"
            autocomplete="off"
            bind:value={classCode}
          /><br />
        </span>
        <p class="hint">
          With a class code from your teacher and your code connected, an AI
          coach gives feedback after each step.
        </p>

        <button id="startBtn" on:click={startGame}>Start Game</button>
      </div>
    {/if}
  </section>
</main>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.5em;
    margin-bottom: 1.5em;
  }

  .title {
    display: inline-block;
    margin: 0;
    font-size: 1.6em;
    font-weight: 400;
  }

  .tagline {
    margin: 0 0 0 2.5em;
    color: var(--glow-green);
    text-shadow: 0 0 2px var(--glow-green), 0 0 5px var(--glow-green);
    opacity: 0.6;
  }

  .menu {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .menu button {
    margin: 0;
    padding: 0;
  }

  main {
    text-align: left;
    padding: 1em;
    max-width: var(--app-width);
    margin: 0 auto;
    color: var(--text-color);
    line-height: 1.45;
  }

  ol {
    padding-left: 2em;
  }

  .setup {
    margin-top: 1.5em;
  }

  .hint {
    font-size: 0.9em;
    color: var(--text-muted);
    margin: 0.2em 0 0.6em 0;
  }

  label {
    display: inline-block;
    min-width: 13em;
  }

  #startBtn {
    font-size: 1.1em;
  }

  #red {
    color: var(--testing-red);
    text-shadow: 0 0 2px var(--testing-red), 0 0 5px var(--testing-red);
  }

  #green {
    color: var(--coding-green);
    text-shadow: 0 0 2px var(--coding-green), 0 0 5px var(--coding-green);
  }

  #blue {
    color: var(--refactoring-blue);
    text-shadow: 0 0 2px var(--refactoring-blue),
      0 0 5px var(--refactoring-blue);
  }
</style>
