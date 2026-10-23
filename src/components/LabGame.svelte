<script>
  // The refactor lab (DESIGN-refactor-lab.md B): [REFACTOR] ---> [TEST] ---> [COMMIT] --↺
  // One refactoring per round, the tests never change, roles swap after every
  // commit. The app's own rules (lab.js) gate each Done, so it works without
  // the coach; the coach's smell board and reviews come later (build item 4).
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { fade } from "svelte/transition";
  import { helper, refreshHelper } from "../helper.js";
  import { snapshotOf, buildFailed, staleResults, failingTests, currentTests } from "../rules.js";
  import { sendProgress, isCoached, askOrient, askLab, resolveProblem } from "../coach.js";
  import { labStatus, LAB_CARDS, LAB_PHASES } from "../lab.js";
  import { nextStepsDue, runMark, codeKey } from "../content/steps.js";
  import { hintRung, TOP_RUNG } from "../ladder.js";
  import WaitingDots from "./WaitingDots.svelte";
  import BuildError from "./BuildError.svelte";
  import DoNow from "./DoNow.svelte";
  import Fold from "./Fold.svelte";

  export let gameState;
  const dispatch = createEventDispatcher();

  // ---- The coach (DESIGN-refactor-lab.md B.1, B.3-B.5): the smell board, a
  // review of each change since the last commit, the next smell's hint ladder.
  // Without the coach (or when it fails) the lab works on the rules alone.
  $: coached = isCoached($helper);
  let orientAsked = !!gameState.lab?.board;
  let orientLoading = false;
  $: if (coached && snapshot && lab && !orientAsked && !gameState.finished) orient();
  const orient = async () => {
    orientAsked = true;
    orientLoading = true;
    try {
      const { brief } = await askOrient({
        problem: resolveProblem(gameState.problem, $helper.data),
        after: snapshot,
        gameId: gameState.gameId,
        players: gameState.players,
        refactorings: lab.refactorings,
      });
      if (brief?.smells?.length) {
        gameState.setBoard(brief.smells);
        tickN++;
      }
    } catch {
      // no board: the lab carries on without one
    } finally {
      orientLoading = false;
    }
  };
  $: board = lab?.board || [];
  $: smellsLeft = board.filter((s) => !s.resolved).length;
  // the next few smells to fix; the rest (and the resolved ones) on request
  const BOARD_PREVIEW = 3;
  let showAllSmells = false;
  $: shownSmells = showAllSmells ? board : board.filter((s) => !s.resolved).slice(0, BOARD_PREVIEW);
  $: hiddenSmells = board.length - shownSmells.length;

  // a Look on each fresh run or build with changed code, at most once a minute
  let lastLook = null;
  let look = null; // the coach's last answer for this round
  let lookRound = 0;
  $: if (lab && lookRound !== lab.round) {
    look = null;
    lookRound = lab.round;
  }
  $: if (coached && snapshot && lab && !gameState.finished && (buildFailed(snapshot) || !staleResults(snapshot)))
    lookAt(snapshot);
  const lookAt = async (current, { rescue = false } = {}) => {
    const now = Date.now() / 1000;
    // keyed by round, not phase: Test and Commit don't each need a Look of their own
    if (!rescue && !nextStepsDue(lastLook, lab.round, current, now)) return;
    if (!rescue) lastLook = { step: lab.round, run: runMark(current), code: codeKey(current), at: now };
    const round = lab.round;
    const { answer } = await askLab({
      problem: resolveProblem(gameState.problem, $helper.data),
      base: lab.base,
      after: current,
      labPhase: lab.phase,
      round,
      refactorings: lab.refactorings,
      board: lab.board || [],
      ruleFindings: (status?.lines || []).filter((l) => l.ok === false).map((l) => l.reason || l.text),
      gameId: gameState.gameId,
      players: gameState.players,
      rung,
      rescue,
    });
    if (!answer || gameState.lab?.round !== round) return;
    if (rescue) return (rescueShown = { code: answer.rescue_code, why: answer.rescue_why });
    look = answer;
    lookBuildTime = buildFailed(current) ? current.build.time : null;
    gameState.labReview(answer);
    tickN++;
    report();
  };
  // A failed build, explained (BuildError); the coach's sentence about it only
  // while it's the build that Look saw.
  let lookBuildTime = null;
  $: buildErrors = snapshot && buildFailed(snapshot) ? snapshot.build.errors || [] : [];
  $: buildHelp = buildErrors.length && look?.build_help && snapshot.build.time === lookBuildTime ? look.build_help : "";
  $: review = look?.move_review && look.move_review.effect !== "none" ? look.move_review : null;
  $: broke = !!review && !review.behaviour_kept && !!snapshot && (buildFailed(snapshot) || failingTests(snapshot).length > 0);

  // the hint ladder for the next smell: one rung more per "More help", or after 5 minutes
  let nowSec = Date.now() / 1000;
  const clock = setInterval(() => (nowSec = Date.now() / 1000), 30_000);
  onDestroy(() => clearInterval(clock));
  $: struggle = (tickN, gameState.struggleFor(gameState.stepNumber));
  $: rung = hintRung({ moreHelp: struggle.moreHelp, minutesOnStep: (nowSec - struggle.startedAt) / 60 });
  $: hintText = look
    ? { question: look.hint_question, kind: rung >= 2 ? look.hint_kind : "", action: rung >= 3 ? look.driver_action : "" }
    : null;
  const moreHelp = () => {
    gameState.noteMoreHelp(gameState.stepNumber);
    gameState.noteHintShown(gameState.stepNumber, Math.min(TOP_RUNG, rung + 1));
    tickN++;
  };
  let rescueShown = null; // {code, why}: the code for one refactoring move, from rung 3 on request
  let rescueWaiting = false;
  $: if (lab && lookRound === lab.round && !look) rescueShown = null;
  const askRescue = async () => {
    rescueWaiting = true;
    try {
      await lookAt(snapshot, { rescue: true });
      gameState.noteRescue(rescueShown?.why || "");
      report();
    } finally {
      rescueWaiting = false;
    }
  };

  let tickN = 0; // bumped after each gameState change (it mutates in place)
  $: lab = (tickN, gameState.lab);
  $: phase = lab?.phase || "refactor";
  $: card = LAB_CARDS[phase];
  $: snapshot = $helper.status === "connected" ? snapshotOf($helper.data) : null;
  $: status = snapshot && lab ? labStatus(phase, lab.base, snapshot) : null;
  $: helperMissing = $helper.status !== "connected";
  $: locked = helperMissing || !status?.goalMet;
  $: driver = gameState.players[gameState.driver];
  $: navigators = gameState.players.filter((p, i) => p && i !== gameState.driver);

  // ---- The card's one "do this now" (DoNow): the first problem on the
  // to-do list, else the phase's task, else (all ticked) Done.
  $: problem = status?.lines.find((l) => l.ok === false);
  $: doNow = problem
    ? phase === "commit" && problem.reason
      ? `${problem.text}. ${problem.reason}`
      : problem.reason || problem.text
    : status?.goalMet
    ? "Everything is ticked: click Done below."
    : card.driver;
  $: navigatorNumber = gameState.players.findIndex((p, i) => p && i !== gameState.driver) + 1;
  $: nextSmell = board.find((s) => !s.resolved);
  $: boardClear = board.length > 0 && !smellsLeft;
  const EFFECT_TEXT = { better: "better", same: "about the same", worse: "harder to read" };

  // a broken change, then a fixed one, is a revert for the teacher
  $: if (snapshot && lab && !staleResults(snapshot)) {
    const red = buildFailed(snapshot) || failingTests(snapshot).length > 0;
    const green = !red && currentTests(snapshot).length > 0;
    gameState.labRun({ red, green });
  }

  let waiting = false;
  const report = async () => {
    const progress = gameState.progress();
    if ((await sendProgress(progress)) && progress.events.length) gameState.ackEvents(progress.events.length);
  };

  const done = async () => {
    if (waiting || helperMissing) return;
    waiting = true;
    if (await refreshHelper()) await tick(); // the code as it is on disk now
    waiting = false;
    if (!status?.goalMet) return;
    gameState.labDone(snapshot);
    tickN++;
    report();
  };

  // Change of hat (README: "never wear both hats at once"): only between
  // rounds, so the last refactoring is committed and nothing is half done.
  $: canSwitch = phase === "refactor" && !helperMissing && status?.lines[0]?.ok !== true;
  const switchToTdd = () => {
    if (!canSwitch || !confirm("Switch to TDD? From now on you add features with Red, Green, Refactor.")) return;
    gameState.switchToTdd();
    report();
    dispatch("switched");
  };

  const finish = () => {
    if (!confirm("Finish the lab? This ends the game.")) return;
    gameState.finish();
    tickN++;
    report();
  };
</script>

<div class="labLine" role="img" aria-label="Round {lab?.round || 1}, {card?.title}">
  {#each LAB_PHASES as p, i}
    <span class="ph" class:on={!gameState.finished && p === phase}>[{LAB_CARDS[p].title.toUpperCase()}]</span
    >{#if i < LAB_PHASES.length - 1}<span class="arrow"> ---> </span>{:else}<span class="arrow" title="Swap roles, next round"> --↺</span>{/if}
  {/each}
  <span class="round">{gameState.finished ? "  Finished" : `  Round ${lab?.round || 1}`}</span>
</div>

{#if gameState.finished}
  <div class="labCard" transition:fade>
    <p class="title aoc-heading">Lab finished</p>
    <p>{lab?.rounds || 0} refactoring{lab?.rounds === 1 ? "" : "s"} committed{lab?.reverts ? `, ${lab.reverts} undone after a red run` : ""}.</p>
  </div>
{:else if lab}
  <div class="labCard phase-{phase}" transition:fade>
    <p class="title aoc-heading">Round {lab.round}: {card.title}</p>
    <!-- One card, one thing to do now: this line, then what blocks it, the
         to-do list and Done. Everything else is folded away at the bottom. -->
    <DoNow
      {driver}
      driverNumber={gameState.driver + 1}
      action={doNow}
      {navigators}
      {navigatorNumber}
      navigatorAction={card.navigator}
      held={!!problem || broke}
    >
      {#if phase === "refactor" && nextSmell}
        <p class="nextSmell">
          Next on the smell board: <strong>{nextSmell.where}:</strong> {nextSmell.what}
          <span class="muted">({nextSmell.refactoring})</span>
        </p>
      {/if}
      {#if phase === "commit" && look?.commit_message}
        <p class="muted">Suggested commit message: <strong>{look.commit_message}</strong></p>
      {/if}
    </DoNow>

    {#if broke}
      <div class="brokeBox">
        <p class="marker">That change broke something: undo the last change</p>
        {#if review.note}<p>What probably broke: {review.note}</p>{/if}
      </div>
    {/if}

    {#if !helperMissing}
      <BuildError errors={buildErrors} coachHelp={buildHelp} />
    {/if}
    {#if helperMissing}
      <p class="doneHint locked">Waiting for the helper</p>
    {:else if status?.lines.length}
      <ul class="todo">
        {#each status.lines as line}
          <li class:done={line.ok === true}>
            <span class="box" aria-label={line.ok === true ? "done" : "not done"}>{line.ok === true ? "[✓]" : "[✖]"}</span>
            <span>
              {line.text}
              {#if line.reason}<span class="reason">{line.reason}</span>{/if}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
    <div class="actions">
      {#if waiting}
        <button disabled>Checking<WaitingDots /></button>
      {:else}
        <button class:lockedDone={locked} aria-disabled={locked} on:click={done}>{card.done}</button>
      {/if}
    </div>
    <!-- a clear board makes switching to TDD the next thing to do; until then it waits under More -->
    {#if boardClear}
      <div class="switchRow">
        <p>
          <span class="clear">The board is clear. </span>
          {lab.rounds} refactoring{lab.rounds === 1 ? "" : "s"} committed.
          {#if !canSwitch}<span class="muted">Commit this round's refactoring before switching.</span>{/if}
        </p>
        <button class="ready" disabled={!canSwitch} on:click={switchToTdd}>Ready for new features: switch to TDD</button>
      </div>
    {/if}

    <!-- Everything else, folded: secondary, and only when there's something in it -->
    {#if orientLoading}
      <p class="muted">The coach is reading your code for smells<WaitingDots label="Reading your code" /></p>
    {:else if board.length}
      <Fold title="Smell board" note={smellsLeft ? `${smellsLeft} of ${board.length} left` : "clear ✓"}>
        <ul class="board">
          {#each shownSmells as smell}
            <li class:resolved={smell.resolved}>
              <span class="box">{smell.resolved ? "[✓]" : "[ ]"}</span>
              <span><strong>{smell.where}:</strong> {smell.what} <span class="muted">({smell.refactoring}{smell.from_readme ? "" : ", extra"})</span></span>
            </li>
          {/each}
        </ul>
        {#if hiddenSmells > 0}
          <button class="quiet more" on:click={() => (showAllSmells = true)}>… {hiddenSmells} more: show all</button>
        {:else if showAllSmells && board.length > BOARD_PREVIEW}
          <button class="quiet more" on:click={() => (showAllSmells = false)}>Show fewer</button>
        {/if}
      </Fold>
    {/if}

    {#if phase === "refactor" && hintText?.question}
      <Fold title="Hints" note={rescueShown ? "the code for one move" : rung >= 3 ? "Think, Look for, Try" : rung >= 2 ? "Think, Look for" : "Think"}>
        <div class="ladder">
          <p><span class="label">Think:</span> {hintText.question}</p>
          {#if hintText.kind}<p><span class="label">Look for:</span> {hintText.kind}</p>{/if}
          {#if hintText.action}<p><span class="label">Try:</span> {hintText.action}</p>{/if}
          {#if rung < TOP_RUNG}
            <button class="quiet" on:click={moreHelp}>More help</button>
          {:else if !rescueShown}
            <button class="quiet" disabled={rescueWaiting} on:click={askRescue}
              >{rescueWaiting ? "Asking the coach…" : "Show me the code"}</button
            >
          {/if}
          {#if rescueShown}
            {#if rescueShown.why}<p>{rescueShown.why}</p>{/if}
            {#if rescueShown.code}<pre class="rescueCode">{rescueShown.code}</pre>
              <p class="muted">Type it in yourself, then run the tests.</p>{/if}
          {/if}
        </div>
      </Fold>
    {/if}

    {#if (review && !broke) || (look?.note && !broke)}
      <Fold title="Coach on your change" note={review && !broke ? EFFECT_TEXT[review.effect] : ""}>
        {#if review}
          <p class="review effect-{review.effect}">
            {review.refactoring}{review.refactoring ? ", " : ""}{EFFECT_TEXT[review.effect]}.
            {review.note}
          </p>
        {/if}
        {#if look?.note}
          <p><span class="who">Coach:</span> {look.note}</p>
        {/if}
      </Fold>
    {/if}

    <Fold title="More">
      <!-- once there's a board, it names each smell's refactoring itself -->
      {#if lab.refactorings?.length && !board.length}
        <p class="muted">Refactorings for this lab: {lab.refactorings.join(", ")}</p>
      {/if}
      {#if !boardClear}
        <div class="switchRow">
          <p>
            {lab.rounds} refactoring{lab.rounds === 1 ? "" : "s"} committed.
            {#if !canSwitch}<span class="muted">Commit this round's refactoring before switching.</span>{/if}
          </p>
          <button disabled={!canSwitch} on:click={switchToTdd}>Ready for new features: switch to TDD</button>
        </div>
      {/if}
      <p class="finishRow">
        <button class="quiet" on:click={finish}>Finish the lab</button>
      </p>
    </Fold>
  </div>
{/if}

<style>
  .labLine {
    margin: 0.2em 0 0.6em 0;
    white-space: nowrap;
    overflow-x: auto;
    color: var(--refactoring-blue);
  }

  .ph,
  .arrow {
    opacity: 0.45;
    padding: 0;
  }

  .on {
    opacity: 1;
    text-shadow: 0 0 2px currentColor, 0 0 6px currentColor;
    font-weight: 500;
  }

  .round {
    color: var(--text-bright);
  }

  .labCard {
    padding: 0.6em 1em;
    border: 1px solid var(--refactoring-blue);
    background: var(--bg-panel);
    --phase-col: var(--refactoring-blue); /* DoNow's edge */
  }

  .nextSmell {
    margin: 0.3em 0;
    font-size: 0.9em;
  }

  /* the phase's to-do list: [✓] green when done, [✖] red until then */
  .todo {
    list-style: none;
    padding-left: 0;
  }

  .todo li {
    display: flex;
    gap: 0.5em;
    margin: 0.2em 0;
    color: var(--testing-red);
  }

  .todo li.done {
    color: var(--coding-green);
  }

  .todo .box {
    flex: none;
  }

  .reason {
    display: block;
    font-size: 0.9em;
  }

  .doneHint {
    margin: 0.6em 0 0 0;
    text-align: center;
    font-size: 0.9em;
  }

  .doneHint.locked {
    color: var(--testing-red);
  }

  .actions {
    display: flex;
    justify-content: center;
    margin-top: 0.4em;
  }

  .lockedDone {
    opacity: 0.55;
  }

  .muted,
  .quiet {
    color: var(--text-muted);
  }

  .finishRow {
    margin: 0.6em 0 0 0;
    text-align: right;
  }

  .clear {
    color: var(--coding-green);
  }

  .switchRow {
    margin-top: 0.8em;
    padding-top: 0.4em;
    border-top: 1px solid var(--opacity-50);
    text-align: center;
  }

  .switchRow p {
    margin: 0.3em 0;
  }

  .switchRow .muted {
    display: block;
    font-size: 0.9em;
  }

  .ready {
    color: var(--star);
    text-shadow: 0 0 5px var(--star);
  }

  ul.board {
    list-style: none;
    padding-left: 0.4em;
  }

  .board li {
    display: flex;
    gap: 0.5em;
    margin: 0.2em 0;
  }

  .board .box {
    flex: none;
    white-space: pre; /* "[ ]" stays on one line, as wide as "[✓]" */
  }

  .more {
    margin: 0 0 0.3em 0.4em;
    font-size: 0.9em;
  }

  .board li.resolved {
    color: var(--text-muted);
    text-decoration: line-through;
  }

  .who,
  .label {
    color: var(--refactoring-blue);
  }

  .review,
  .ladder {
    padding-left: 0.6em;
    border-left: 2px solid var(--refactoring-blue);
  }

  .review.effect-worse {
    border-left-color: var(--amber);
  }

  .ladder p {
    margin: 0.3em 0;
  }

  .brokeBox {
    padding: 0.3em 0.8em;
    border: 1px solid var(--testing-red);
  }

  .marker {
    color: var(--testing-red);
    font-weight: 500;
  }

  .rescueCode {
    overflow-x: auto;
    padding: 0.4em;
    background: var(--bg);
  }
</style>
