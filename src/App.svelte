<script>
  import Game from "./components/Game.svelte";
  //import {gameState} from './store.js';
  //import {reStartGame, startGame} from './gameLogic.js';
  import { GameState } from "./gameState";
  import { fly } from "svelte/transition";
  import HelperStatus from "./components/HelperStatus.svelte";
  import { helper, startHelper, resetHelper, enableHelper, BLOCKED_HELP } from "./helper.js";
  import { testNames } from "./rules.js";
  import { startCoach, resetCoach, getClassCode, setClassCode } from "./coach.js";

  startHelper();
  startCoach();

  let thirdPlayer;
  let classCode = getClassCode();
  let gameState = GameState.recoverSavedGame();
  if (!gameState) {
    gameState = new GameState();
  }
  // A teacher can share a link with ?problem=... to fill in the problem box.
  let problem =
    gameState.problem ||
    new URLSearchParams(window.location.search).get("problem") ||
    "";
  let enforceRules = gameState.enforceRules ?? true;

  // With the helper connected and tests in the source but no results yet, wait
  // for a first run so the game starts from where the code really is. A project
  // with no tests (nothing to run) or no helper starts straight away.
  $: needsTestRun =
    $helper.status === "connected" &&
    testNames($helper.data).size > 0 &&
    !($helper.data.run > 0 || $helper.data.tests?.length);
  // The game checks every step against the pair's code, so it needs the helper.
  $: helperConnected = $helper.status === "connected";
  // Copied next to the bundle by rollup.config.js
  const HELPER_URL = "build/rgg_server.py";

  const startGame = () => {
    if (thirdPlayer) gameState.players[2] = thirdPlayer;
    gameState.problem = problem.trim();
    gameState.enforceRules = enforceRules;
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
        Red-Green-Go! walks a pair (or three) through Test Driven Development
        on any problem, one small step at a time. One of you
        <em>drives</em> (types), the others <em>navigate</em> (think ahead and
        talk it through). Each cycle has three steps:
      </p>
      <ol>
        <li>
          <strong>Red.</strong> Write one small test for something your code
          <em>should</em> do but doesn't yet, and watch it fail. A test that
          doesn't compile counts as failing.
        </li>
        <li>
          <strong>Green.</strong> Write just enough code to make that test
          pass. Simple, even hard-coded, is fine. Don't change the tests.
        </li>
        <li>
          <strong>Refactor.</strong> With every test passing, tidy the code:
          remove duplication, improve names, generalise. The tests must stay
          green.
        </li>
      </ol>
      <p>
        You swap driver after each Red, and keep cycling until the problem is
        solved.
      </p>
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

        <h2 class="aoc-heading">What are you building?</h2>
        <label class="block" for="problem">Describe the problem (optional)</label>
        <textarea
          id="problem"
          name="problem"
          rows="4"
          placeholder="e.g. A function that converts numbers to Roman numerals"
          bind:value={problem}
        />
        <p class="hint">
          The coach uses this to suggest your next test. Leave it empty and it
          works it out from your code (or a README.md in your solution folder).
        </p>

        <label class="checkbox">
          <input type="checkbox" bind:checked={enforceRules} />
          Enforce TDD rules
        </label>
        <p class="hint">
          With your code connected, the game holds you on a step that breaks
          the rules (e.g. more than one new test on Red). Unticked, it only
          warns you.
        </p>

        <div class="startRow">
          <button id="startBtn" disabled={!helperConnected || needsTestRun} on:click={startGame}
            >Start Game</button
          >
          {#if $helper.status === "blocked"}
            <span class="hint blockedHint">{BLOCKED_HELP}</span>
          {:else if !helperConnected}
            <span class="hint">Run <code>python rgg_server.py</code> in your project folder to start</span>
          {:else if needsTestRun}
            <span class="hint">Run your tests in Visual Studio's Test Explorer first</span>
          {/if}
        </div>
        {#if !helperConnected}
          <p class="hint helperRow">
            <a href={HELPER_URL} download>Download rgg_server.py</a>
            {#if $helper.status === "off"}
              <button on:click={enableHelper}>Connect</button>
            {:else if $helper.status !== "blocked"}
              <span>Looking for the helper…</span>
            {/if}
          </p>
          {#if $helper.status === "offline"}
            <p class="hint">
              Running it but still not connecting? Chrome may be blocking this page: click the icon left of
              the address bar → Site settings → Local network access → Allow, then reload.
            </p>
          {/if}
        {/if}
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

  label.block {
    display: block;
  }

  label.checkbox {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-top: 1em;
    color: var(--text-bright);
  }

  label.checkbox input {
    margin: 0;
    accent-color: var(--glow-green);
  }

  textarea {
    display: block;
    width: 100%;
    resize: vertical;
  }

  .startRow {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5em 1em;
    margin-top: 1em;
  }

  #startBtn {
    font-size: 1.1em;
    margin: 0;
  }

  .helperRow {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5em 1em;
  }

  .helperRow button {
    margin: 0;
  }

  .blockedHint {
    color: var(--testing-red);
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
