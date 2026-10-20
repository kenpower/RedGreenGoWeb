<script>
  import HintLabel from "./HintLabel.svelte";
  import { fade, fly } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  import Icon from "./Icon.svelte";
  import WaitingDots from "./WaitingDots.svelte";
  import { helper } from "../helper.js";

  const dispatch = createEventDispatcher();
  const interact = (what) => dispatch("interact", what);

  export let step;
  // Kept out of `step` so values that change mid-step (when a coach verdict
  // arrives) update in place instead of re-keying the card and the hint timer.
  export let hint = "";
  // The "What to do now" lines, already chosen by Game: {driver, navigator}.
  export let instructions = { driver: "", navigator: "" };
  // "red" | "amber" | "green" | "", computed by Game
  export let tone = "";
  // the one-line note carried over from the previous step's verdict
  export let feedback = "";
  // waiting: Done was clicked; the rules and the coach are looking at the step.
  // held: the step broke the rules or the coach wasn't happy.
  export let waiting = false;
  export let held = false;
  // The coach's verdict for this step, or null. Only read for why the pair is
  // held, or why the coach disagreed that they're finished.
  export let coach = null;
  // rule findings [{rule, message}]: why we're held without the coach, or
  // warnings when the rules aren't enforced
  export let findings = [];
  export let canAskAgain = true;
  // the [Finished] flow, offered on Refactor steps only
  export let finishState = "idle"; // "idle" | "asking" | "disagreed"
  export let likelyFinished = false;
  // Before a Red step, where the pair's code stands. "" means a clean start
  // (or no check): the normal Red card. Game re-checks on every helper update.
  export let startState = ""; // "unknown" | "build_failed" | "one_failing" | "many_failing"
  export let failingTests = [];
  export let buildErrors = [];
  // true after [No, start fresh] on one_failing
  export let freshStart = false;
  // Source files not yet committed. Held ("uncommitted"): the live list. Not
  // enforced: the list when this Red started, shown as a warning.
  export let uncommittedFiles = [];
  // the helper is connected but the project isn't in git (or git failed)
  export let noRepo = false;
  // git is missing or failing on this machine: not the pair's fault, so no tip
  $: gitError = $helper.data?.git?.error;
  // who the feedback line is from: "Coach", or "" for the game's own notes
  // ("Not yet: …", "Helper disconnected…", the automatic back to Red)
  export let feedbackWho = "";

  // Live steps (rules.liveStatus, computed by Game on every helper update):
  // lines [{text, ok}] (ok true = met, false = not yet, null = waiting),
  // the test this step is about, and whether Done may be clicked.
  export let liveLines = [];
  export let focusTest = null;
  export let goalMet = false;
  export let doneLocked = false;
  // the rules aren't enforced and there's no coach: unmet lines are warnings
  export let amberLive = false;
  export let entryProblem = null; // {kind, message}, e.g. Refactor entered with failing tests
  export let liveAdvice = []; // never a hold: vague test names, code written before its test
  export let helperMissing = false; // Red/Green/Refactor wait for the helper
  // Cycles 1–2: numbered steps [{text, why?, done}], ticked live; [] after
  export let guide = [];

  const DONE_HINT = {
    red: "Click Done when exactly one test is failing (red)",
    green: "Click Done when all tests pass (green)",
    refactor: "Click Done when the code is tidier and all tests still pass",
  };
  const DONE_MET = { red: "Done: our one test fails ✓", green: "Done: all tests pass ✓", refactor: "Done: still green ✓" };
  // the live Done: what's still missing while locked, the label once met
  $: liveDone = isCycleStep && (liveLines.length > 0 || helperMissing);
  $: lockReason = helperMissing ? "Waiting for the helper" : liveLines.find((l) => l.ok !== true)?.text || "";
  $: doneLabel = liveDone ? (goalMet && !doneLocked ? DONE_MET[step.stateName] : "Done") : step.buttonText;
  // the first guide step not yet ticked is the one to do now
  $: currentGuide = guide.findIndex((g) => g.done !== true);

  // What the start card says for each state. `box` picks the box colour,
  // `wait` is what the game is waiting to see before carrying on.
  const startCard = (state, failing, errors, fresh, uncommitted) => {
    const name = failing[0] || "a test";
    switch (state) {
      case "uncommitted":
        return {
          box: "heldBox",
          heading: "Commit first",
          message: "Commit your work before writing the next test.",
          list: uncommitted,
          driver: "Commit with a message that says what this cycle achieved.",
          navigator: "Suggest the commit message.",
          wait: "Waiting for a commit",
        };
      case "unknown":
        return {
          box: "infoBox",
          heading: "Run your tests first",
          message: "Run your tests in Visual Studio so the game can see where you are.",
          driver: "Build the solution and run all the tests in Test Explorer.",
          navigator: "Check the badge at the top of the page says the code is connected.",
          wait: "Waiting for your test run",
        };
      case "build_failed":
        return {
          box: "heldBox",
          heading: "Fix the build first",
          message: "Your code doesn't build, so the game can't tell which tests pass.",
          list: errors.slice(0, 5),
          driver: "Fix the compile errors, then build and run the tests.",
          navigator: "Read the first error aloud and find the line it points to.",
          wait: "Waiting for a clean build",
        };
      case "one_failing":
        return fresh
          ? {
              box: "warnBox",
              heading: "Get to a clean start",
              message: `Make ${name} pass, or comment it out. The game carries on once no tests fail.`,
              driver: `Make ${name} pass or comment it out, then run the tests.`,
              navigator: "Check no other test starts failing while you do it.",
              wait: "Waiting for no failing tests",
            }
          : {
              box: "questionBox",
              heading: "Is this your Red test?",
              message: `You already have one failing test (${name}). Is this your Red test?`,
              driver: "Say whether this test is the next small behaviour you want to build.",
              navigator: "Check the failing test belongs to the work you're about to do.",
              ask: true,
            };
      case "many_failing":
        return {
          box: "warnBox",
          heading: "Get to a clean start",
          message: `${failing.length} tests fail. Fix them or comment them out until at most one fails.`,
          list: failing,
          driver: "Fix or comment out failing tests, running the tests as you go.",
          navigator: "Check which failing test belongs to the work you're about to do; that one can stay.",
          wait: "Waiting for at most one failing test",
        };
      default:
        return null;
    }
  };
  $: start = startCard(startState, failingTests, buildErrors, freshStart, uncommittedFiles);
  $: isRed = step.stateName == "red";
  // not enforced: warn, but Red carries on
  $: commitWarning = isRed && !start && uncommittedFiles.length > 0;

  $: isCycleStep = step.stateName != "swap";
  $: busy = waiting || finishState == "asking";
  $: heldByCoach = held && coach;
  $: heldReason = heldByCoach
    ? "fix this first"
    : findings.some((f) => f.rule == "one_failing")
    ? "only one test may fail in Red"
    : "a TDD rule isn't met yet";
  // One thing at a time: only the most important problem. The coach orders
  // its rule_problems that way; for the app's own findings, one_failing (which
  // the held marker names) comes first, otherwise the first finding.
  $: firstFinding = findings.find((f) => f.rule == "one_failing") || findings[0];
  $: reason = heldByCoach ? coach.rule_problems?.[0] : firstFinding?.message;
  $: canFinish = step.stateName == "refactor" && !held && !waiting && !helperMissing;

  //TODO move into game
  function scrollIntoView() {
    const el = document.getElementById("theStep");
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
    });
  }

  $: {
    scrollIntoView(); //no state here, so does it ever get called?
  }
</script>

{#key step}
  <div
    out:fade
    in:fly={{ delay: 300, y: 400, duration: 1000 }}
    class={step.classes}
    id="theStep"
  >
    <p class="title aoc-heading">{step.title}</p>

    {#if feedback && (!held || helperMissing)}
      <p class="feedback tone-{tone}" class:banner={!feedbackWho}>
        {#if feedbackWho}<span class="who">{feedbackWho}:</span>{/if}
        {feedback}
      </p>
    {/if}

    {#if start}
      <div class={start.box}>
        <p class="marker">{start.heading}</p>
        <p>{start.message}</p>
        {#if start.list?.length}
          <ul>
            {#each start.list as item}<li>{item}</li>{/each}
          </ul>
        {/if}
      </div>
    {:else if held}
      <div class="heldBox" transition:fade>
        <p class="marker">Stay on this step: {heldReason}</p>
        {#if heldByCoach && coach.note}
          <p>{coach.note}</p>
        {/if}
        {#if reason}
          <p>{reason}</p>
        {/if}
      </div>
    {:else if findings.length}
      <div class="warnBox">
        <p class="marker">Heads up: a TDD rule isn't met (you can carry on)</p>
        <p>{firstFinding.message}</p>
      </div>
    {/if}

    {#if entryProblem && !start && !held}
      <div class="warnBox">
        <p class="marker">Heads up</p>
        <p>{entryProblem.message}</p>
      </div>
    {/if}

    {#if commitWarning && !held}
      <div class="warnBox">
        <p class="marker">Heads up: commit first (you can carry on)</p>
        <p>Commit your work before writing the next test.</p>
        <ul>
          {#each uncommittedFiles as file}<li>{file}</li>{/each}
        </ul>
      </div>
    {/if}

    <div class="stepBody">
      {#if step.stateName == "swap"}
        <div class="handover" style="--player-col: var(--player-{step.driverNumber})">
          <Icon icon="swap" size="40px" />
          <p class="handoverText">Hand the keyboard to {step.driver}</p>
          <p>{step.bodyText}</p>
          {#if guide[0]?.why}<p class="why">{guide[0].why}</p>{/if}
        </div>
      {:else}
        <div class="driverBanner" style="--player-col: var(--player-{step.driverNumber})">
          <Icon icon="keyboard" />
          <span>{step.driver} is driving</span>
        </div>
        {#each step.navigators as navigator, i}
          <div class="navigatorLine" style="--player-col: var(--player-{step.navigatorNumbers[i]})">
            <Icon icon="navigation" />
            <span><strong class="playerName">{navigator}</strong> is navigating</span>
          </div>
        {/each}

        {#if !start && guide.length}
          <h3 class="todoHeading">Step by step</h3>
          <ol class="guide">
            {#each guide as item, i}
              <li class:current={i === currentGuide} class:ticked={item.done === true} class:wrong={item.done === false}>
                <span class="tick" aria-hidden="true">{item.done === true ? "✓" : item.done === false ? "✗" : ""}</span>
                {item.text}
                {#if item.why}<span class="why">{item.why}</span>{/if}
              </li>
            {/each}
          </ol>
        {:else if !start && liveLines.length}
          <ul class="live" class:amberLive title={focusTest ? `This step is about ${focusTest}` : ""}>
            {#each liveLines as line}
              <li class="ok-{line.ok}">{line.text}</li>
            {/each}
          </ul>
        {/if}
        {#each liveAdvice as text}
          <p class="advice"><span class="adviceLabel">Advice:</span> {text}</p>
        {/each}

        <h3 class="todoHeading" class:compactHeading={guide.length > 0}>What to do now</h3>
        <dl class="todo" class:heldTodo={held && !start} class:compact={guide.length > 0}>
          {#if (start || instructions).driver}
            <dt style="--player-col: var(--player-{step.driverNumber})">Driver</dt>
            <dd>{(start || instructions).driver}</dd>
          {/if}
          {#if (start || instructions).navigator}
            <dt style="--player-col: var(--player-{step.navigatorNumbers[0]})">
              Navigator{step.navigators.length > 1 ? "s" : ""}
            </dt>
            <dd>{(start || instructions).navigator}</dd>
          {/if}
        </dl>

        {#if !held && !start}
          <div><HintLabel text={hint} /></div>
        {/if}
        {#if isRed && noRepo}
          <p class="muted tip">
            {#if gitError}
              The helper couldn't run git, so commits aren't checked.
            {:else}
              Tip: put your project in git; the game will remind you to commit each cycle.
            {/if}
          </p>
        {/if}
      {/if}

      {#if liveDone && !start && !held && !waiting}
        <p class="doneHint" class:locked={doneLocked}>{doneLocked ? lockReason : DONE_HINT[step.stateName]}</p>
      {/if}
      <div class="actions">
        {#if start?.ask}
          <button disabled={helperMissing} on:click={() => interact("useExisting")}>Yes, use it</button>
          <button class="override" disabled={helperMissing} on:click={() => interact("startFresh")}
            >No, start fresh</button
          >
        {:else if start}
          <p class="muted">{start.wait}<WaitingDots /></p>
        {:else if waiting}
          <button disabled>Waiting for the coach<WaitingDots /></button>
        {:else if held}
          <button
            disabled={!canAskAgain || busy || helperMissing}
            title={canAskAgain ? "" : "Change your code first"}
            on:click={() => interact("askAgain")}
            >{heldByCoach ? "Ask the coach again" : "Check again"}</button
          >
          <button class="override" disabled={busy || helperMissing} on:click={() => interact("override")}
            >Progress despite this advice</button
          >
        {:else}
          <button
            class:ready={liveDone && goalMet && !doneLocked}
            disabled={busy || (isCycleStep && doneLocked)}
            on:click={() => interact("done")}>{doneLabel}</button
          >
        {/if}
      </div>

      {#if canFinish}
        <div class="finish" class:likely={likelyFinished || finishState == "disagreed"}>
          {#if finishState == "asking"}
            <p class="muted">Asking the coach if you're finished<WaitingDots /></p>
          {:else if finishState == "disagreed"}
            <p class="marker">Keep going: the coach thinks there's more to do</p>
            {#if coach?.note}<p>{coach.note}</p>{/if}
            {#if coach?.next_test}
              <p><strong>Next test:</strong> {coach.next_test}</p>
            {/if}
            <button class="quiet" on:click={() => interact("finishAnyway")}>Finish anyway</button>
          {:else}
            {#if likelyFinished}
              <p>The coach thinks you may have solved the problem.</p>
            {/if}
            <button class:quiet={!likelyFinished} on:click={() => interact("finish")}
              >Finished</button
            >
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/key}

<style>
  .driverBanner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    margin: 0.5em 0;
    padding: 0.35em;
    border: 1px solid var(--player-col);
    color: var(--player-col);
    text-shadow: 0 0 4px var(--player-col);
    font-size: 1.2em;
    font-weight: 500;
  }

  .navigatorLine {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
  }

  .playerName {
    color: var(--player-col);
  }

  .feedback {
    margin: 0 0 0.6em 0;
    padding: 0.2em 0.6em;
    border-left: 2px solid var(--tone-col, var(--text-muted));
    background: var(--opacity-50);
  }

  .feedback .who {
    color: var(--tone-col, var(--text-muted));
  }

  .tone-red {
    --tone-col: var(--testing-red);
  }

  .tone-amber {
    --tone-col: var(--amber);
  }

  .tone-green {
    --tone-col: var(--coding-green);
  }

  /* the game's own notes ("Not yet: …", helper disconnected, back to Red) */
  .feedback.banner {
    border-left-width: 3px;
    color: var(--tone-col, var(--text-color));
  }

  /* live lines: ✓ green, not yet red (amber when the rules are off), waiting muted */
  .live {
    list-style: none;
    margin: 0.6em 0;
    padding: 0;
  }

  .live li {
    margin: 0.2em 0;
    padding-left: 1.2em;
    text-indent: -1.2em;
    overflow-wrap: anywhere;
  }

  .live li::before {
    content: "·";
    display: inline-block;
    width: 1.2em;
    text-indent: 0;
  }

  .live .ok-true {
    color: var(--coding-green);
  }

  .live .ok-false {
    color: var(--testing-red);
  }

  .live.amberLive .ok-false {
    color: var(--amber);
  }

  .live .ok-null {
    color: var(--text-muted);
  }

  /* cycles 1–2: the numbered guide */
  .guide {
    margin: 0.3em 0 0.6em 0;
    padding-left: 1.8em;
  }

  .guide li {
    margin: 0.3em 0;
    overflow-wrap: anywhere;
  }

  .guide li.current {
    color: var(--text-bright);
    text-shadow: 0 0 4px var(--phase-col);
  }

  .guide li.ticked {
    color: var(--text-muted);
  }

  .guide .tick {
    display: inline-block;
    min-width: 1em;
    padding-left: 0;
    color: var(--coding-green);
    text-shadow: none;
  }

  .guide li.wrong .tick {
    color: var(--testing-red);
  }

  .why {
    display: block;
    padding-left: 0;
    font-size: 0.85em;
    color: var(--text-muted);
    text-shadow: none;
  }

  .advice {
    margin: 0.3em 0;
    padding-left: 0.6em;
    border-left: 2px solid var(--amber);
    font-size: 0.9em;
    overflow-wrap: anywhere;
  }

  .adviceLabel {
    padding-left: 0;
    color: var(--amber);
  }

  .compactHeading {
    margin-top: 0.4em;
    font-size: 0.9em;
  }

  .todo.compact {
    font-size: 0.9em;
  }

  .doneHint {
    margin: 0.6em 0 0 0;
    text-align: center;
    font-size: 0.9em;
    color: var(--text-muted);
  }

  .doneHint.locked::before {
    content: "Not yet: ";
  }

  button.ready {
    color: var(--star);
    text-shadow: 0 0 5px var(--star);
  }

  .heldBox,
  .warnBox,
  .questionBox,
  .infoBox {
    margin: 0 0 0.6em 0;
    padding: 0.3em 0.8em;
    border: 1px solid var(--box-col);
    background: var(--bg-panel);
    --box-col: var(--testing-red);
  }

  .warnBox {
    --box-col: var(--amber);
  }

  .questionBox {
    --box-col: var(--star);
  }

  .infoBox {
    --box-col: var(--text-bright);
  }

  .heldBox p,
  .warnBox p,
  .questionBox p,
  .infoBox p {
    margin: 0.3em 0;
  }

  .heldBox ul,
  .warnBox ul {
    overflow-wrap: anywhere;
    margin: 0.3em 0;
    padding-left: 1.5em;
  }

  .marker {
    color: var(--box-col, var(--testing-red));
    text-shadow: 0 0 5px var(--box-col, var(--testing-red));
    font-weight: 500;
  }

  .todoHeading {
    margin: 0.8em 0 0.3em 0;
    font-size: 1em;
    font-weight: 400;
    color: var(--text-bright);
  }

  .todo {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.3em 0.8em;
    margin: 0 0 0.5em 0;
  }

  .todo dt {
    color: var(--player-col);
  }

  .todo dd {
    margin: 0;
  }

  .heldTodo {
    padding-left: 0.6em;
    border-left: 2px solid var(--testing-red);
  }

  .handover {
    margin: 0.5em 0;
    padding: 1em;
    border: 1px solid var(--player-col);
    text-align: center;
  }

  .handoverText {
    font-size: 1.4em;
    margin: 0.3em 0;
    color: var(--player-col);
    text-shadow: 0 0 5px var(--player-col);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-evenly;
    gap: 0.5em;
    margin-top: 0.5em;
  }

  .override,
  .quiet {
    color: var(--text-muted);
  }

  .finish {
    margin-top: 0.8em;
    text-align: right;
    font-size: 0.9em;
  }

  .finish p {
    margin: 0.3em 0;
    text-align: left;
  }

  .finish.likely {
    padding: 0.3em 0.8em;
    border: 1px solid var(--star);
    font-size: 1em;
    --box-col: var(--star);
  }

  .finish.likely button:not(.quiet) {
    color: var(--star);
    text-shadow: 0 0 5px var(--star);
  }

  .muted {
    color: var(--text-muted);
  }

  .tip {
    margin: 0.5em 0 0 0;
    font-size: 0.85em;
  }

  span {
    vertical-align: top;
    padding-left: 0.3em;
  }

  .step {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--phase-col);
    background-color: var(--phase-bg);
    margin-top: 1em;
    padding: 0.8em 1em;
    min-height: 150px;
  }

  .step .title {
    color: var(--phase-col);
    text-shadow: 0 0 5px var(--phase-col);
  }

  .red {
    --phase-col: var(--testing-red);
    --phase-bg: var(--testing-red-hint);
  }

  .green {
    --phase-col: var(--coding-green);
    --phase-bg: var(--coding-green-hint);
  }

  .refactor {
    --phase-col: var(--refactoring-blue);
    --phase-bg: var(--refactoring-blue-hint);
  }

  .swap {
    --phase-col: var(--text-bright);
    --phase-bg: transparent;
  }
</style>
