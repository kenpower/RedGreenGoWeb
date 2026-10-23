<script>
  import Game from "./components/Game.svelte";
  import LabGame from "./components/LabGame.svelte";
  import { parseLab } from "./lab.js";
  //import {gameState} from './store.js';
  //import {reStartGame, startGame} from './gameLogic.js';
  import { GameState } from "./gameState";
  import { fly } from "svelte/transition";
  import HelperStatus from "./components/HelperStatus.svelte";
  import {
    helper, startHelper, resetHelper, enableHelper, BLOCKED_HELP, OFFLINE_HELP, HELPER_PAGE, onGithubPages,
    helperDownloadUrl,
  } from "./helper.js";
  import { testNames, snapshotOf } from "./rules.js";
  import {
    startCoach, resetCoach, getClassCode, setClassCode, linkedClassCode, classCodeFromReadme, checkClassCode,
  } from "./coach.js";

  startHelper();
  startCoach();

  let thirdPlayer;
  // The class code, first wins: typed in the box > ?class= (a teacher's link,
  // or the helper's --class-code) > a "Class code: …" line in README.md.
  // A code remembered from an earlier game counts as typed.
  const linked = linkedClassCode();
  let classCode = linked?.code || getClassCode();
  let classSource = linked ? linked.source : ""; // "" (typed) | "link" | "helper" | "readme"
  $: readmeCode = classCodeFromReadme($helper.data?.readme?.content);
  $: if (!classCode.trim() && readmeCode) {
    classCode = readmeCode;
    classSource = "readme";
  }
  const SOURCES = { link: "from the link", helper: "from the helper", readme: "from README.md" };

  // Start needs a class code the coach server knows. Checked once per code
  // (the check shares the students' rate limit), a moment after typing stops.
  let classCheck = { status: "" }; // "" | "checking" | "ok" | "unknown" | "unreachable"
  let checkTimer;
  const checked = new Map();
  const scheduleCheck = (code) => {
    clearTimeout(checkTimer);
    const clean = (code || "").trim().toUpperCase();
    if (!clean) return (classCheck = { status: "" });
    if (checked.has(clean)) return (classCheck = checked.get(clean));
    classCheck = { status: "checking" };
    checkTimer = setTimeout(async () => {
      const result = await checkClassCode(clean);
      if (result.status !== "unreachable") checked.set(clean, result); // can't-check is retried
      if ((classCode || "").trim().toUpperCase() === clean) classCheck = result;
    }, 700);
  };
  $: scheduleCheck(classCode);
  $: classOk = classCheck.status === "ok";
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
  const HELPER_URL = helperDownloadUrl();

  // The starter README chooses the refactor lab ("Lab: refactor", lab.js)
  $: labChoice = helperConnected ? parseLab($helper.data?.readme?.content) : null;

  const startGame = () => {
    if (thirdPlayer) gameState.players[2] = thirdPlayer;
    gameState.problem = problem.trim();
    gameState.enforceRules = enforceRules;
    setClassCode(classCode);
    if (labChoice) gameState.startLab(labChoice.refactorings, snapshotOf($helper.data));
    else gameState.start();
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
        {#if gameState.mode === "refactor"}
          <LabGame {gameState} on:switched={() => (gameState = gameState)} />
        {:else}
          <Game {gameState} on:restart={reStartGame} />
        {/if}
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
          <label for="classCode">Class code (from your teacher)</label>
          <input
            type="text"
            id="classCode"
            name="classCode"
            autocomplete="off"
            bind:value={classCode}
            on:input={() => (classSource = "")}
          /><br />
        </span>
        <p class="classStatus" aria-live="polite">
          {#if classCheck.status == "checking"}
            <span class="muted">Checking the class code…</span>
          {:else if classCheck.status == "ok"}
            <span class="ok">✓ {classCheck.name}</span>{#if SOURCES[classSource]}
              <span class="muted"> ({SOURCES[classSource]})</span>{/if}
          {:else if classCheck.status == "unknown"}
            <span class="bad">Unknown class code: check with your teacher</span>
          {:else if classCheck.status == "unreachable"}
            <span class="bad">Can't reach the coach server, try again</span>
            <button class="retry" on:click={() => scheduleCheck(classCode)}>Try again</button>
          {/if}
        </p>
        <p class="hint">
          Needed to start. Your teacher gives you this code. You can also run the helper with
          <code>python rgg_server.py --class-code=YOURCODE</code>, or put a line
          <code>Class code: YOURCODE</code> in your project's README.md.
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

        {#if labChoice}
          <p class="labNote">
            <strong>Refactor lab:</strong> this project's README.md makes this game a refactor lab. Your code
            already has passing tests: apply one refactoring at a time, run the tests, commit, then swap roles.
            When the code is clean enough, switch to TDD to add features. Refactorings: {labChoice.refactorings.join(", ")}.
          </p>
        {/if}
        <div class="startRow">
          <button id="startBtn" disabled={!helperConnected || needsTestRun || !classOk} on:click={startGame}
            >Start Game</button
          >
          {#if !classOk && helperConnected && !needsTestRun}
            <span class="hint">Enter your class code above to start</span>
          {:else if $helper.status === "blocked"}
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
          {#if onGithubPages() && ["offline", "blocked"].includes($helper.status)}
            <!-- Chrome may block this page from the helper; the helper's own copy of the game isn't -->
            <p class="playViaHelper">Play via your helper: <a href={HELPER_PAGE}>{HELPER_PAGE}</a></p>
          {/if}
          {#if $helper.status === "offline"}
            <p class="hint">{OFFLINE_HELP}</p>
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
    opacity: 0.85; /* was 0.6: ~3.7:1, below AA; now ~6.5:1 */
  }

  .menu {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5em 1em;
    font-size: 1.08em; /* the badge's counts should stand out */
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

  .labNote {
    padding: 0.3em 0.8em;
    border-left: 2px solid var(--refactoring-blue);
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

  .classStatus {
    min-height: 1.4em;
    margin: 0.1em 0;
  }

  .classStatus .ok {
    color: var(--coding-green);
    text-shadow: 0 0 4px var(--coding-green);
  }

  .classStatus .bad {
    color: var(--testing-red);
  }

  .classStatus .muted {
    color: var(--text-muted);
  }

  .classStatus .retry {
    margin: 0 0 0 0.5em;
  }

  .playViaHelper {
    margin: 0.8em 0;
    padding: 0.4em 0.8em;
    border: 1px solid var(--star);
    color: var(--text-bright);
    font-size: 1.05em;
  }

  .playViaHelper a {
    color: var(--star);
    text-shadow: 0 0 5px var(--star);
    overflow-wrap: anywhere;
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
