<script>
  import Game from "./components/Game.svelte";
  import IconButton from "./components/IconButton.svelte";
  //import {gameState} from './store.js';
  //import {reStartGame, startGame} from './gameLogic.js';
  import { GameState } from "./gameState";
  import { fly } from "svelte/transition";
  import HelperStatus from "./components/HelperStatus.svelte";
  import { startHelper, resetHelper } from "./helper.js";

  startHelper();

  let thirdPlayer;
  let gameState = GameState.recoverSavedGame();
  if (!gameState) {
    gameState = new GameState();
  }
  const startGame = () => {
    if (thirdPlayer) gameState.players[2] = thirdPlayer;
    gameState.start();
    gameState = gameState;
  };

  const reStartGame = () => {
    gameState = new GameState();
    resetHelper();
  };
</script>

<main>
  <header>
    <div class="menu">
      <IconButton onclick={reStartGame} icon="restart" />
    </div>
    <div class="title">
      <svg xmlns="http://www.w3.org/2000/svg">
        <filter id="motion-blur-filter" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="10 0" />
          <feOffset dx="5" />
          <feMorphology operator="erode" radius="1" />
        </filter>
      </svg>
      <span id="red">Red</span>-<span id="green">Green</span>-<span
        filter-content="G"
        class="swoosh"
        id="blue">G</span
      ><span id="blue">o!</span>
    </div>
    <div class="menu"><HelperStatus /></div>
  </header>

  <h2>A game of TDD & Pairing</h2>

  <section>
    {#if gameState.started}
      <div in:fly={{ y: 200, duration: 2000 }}>
        <Game {gameState} on:restart={reStartGame} />
      </div>
    {:else}
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
      <div>
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

        <button id="startBtn" on:click={startGame}>Start Game</button>
      </div>
    {/if}
  </section>
</main>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-tone-4);
  }

  .title {
    font-size: 2.5em;
    font-weight: bold;
  }

  h2 {
    font-size: 1.5em;
    margin: 0.25em;
    font-weight: 300;
    color: var(--text-muted);
  }

  main {
    text-align: center;
    padding: 1em;
    max-width: var(--app-width);
    margin: 0 auto;
    color: var(--text-color);
    line-height: 1.45;
  }

  li {
    text-align: justify;
  }

  label {
    display: inline-block;
    min-width: 10rem;
    text-align: right;
  }

  #red {
    color: var(--testing-red);
  }

  #green {
    color: var(--coding-green);
  }

  #blue {
    color: var(--refactoring-blue);
    font-style: italic;
    transform: skew(45deg, 50deg);
  }

  .swoosh::before {
    content: attr(filter-content);
    filter: url(#motion-blur-filter);
  }

  svg {
    display: none;
  }
</style>
