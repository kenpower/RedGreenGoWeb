<script>
  // The refactor lab (DESIGN-refactor-lab.md B): [REFACTOR] ---> [TEST] ---> [COMMIT] --↺
  // One refactoring per round, the tests never change, roles swap after every
  // commit. The app's own rules (lab.js) gate each Done, so it works without
  // the coach; the coach's smell board and reviews come later (build item 4).
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { fade } from "svelte/transition";
  import { helper, ide, refreshHelper } from "../helper.js";
  import { tailor } from "../ide.js";
  import { snapshotOf, buildFailed, staleResults, failingTests, currentTests, uncommittedFiles } from "../rules.js";
  import { sendProgress, isCoached, askOrient, askLab, resolveProblem } from "../coach.js";
  import { labStatus, productionChanged, codeChanged, ownSmellsListed, MIN_OWN_SMELLS, LAB_CARDS, LAB_PHASES } from "../lab.js";
  import { nextStepsDue, runMark, codeKey } from "../content/steps.js";
  import { parseWorksheet, worksheetProblem, renderMarkdown, stepHeadline } from "../worksheet.js";
  import { hintRung, TOP_RUNG } from "../ladder.js";
  import WaitingDots from "./WaitingDots.svelte";
  import PredictBox from "./PredictBox.svelte";
  import MessGuide from "./MessGuide.svelte";
  import { outcomeOf } from "../predict.js";
  import Reflection from "./Reflection.svelte";
  import HowTo from "./HowTo.svelte";
  import Glossary from "./Glossary.svelte";
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
        problem: labProblem,
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
  // "Smells first": with a smells.md, the board (and the hints and next smell
  // that come from it) wait until the pair has listed smells of their own
  $: boardHidden = !!lab?.ownSmells && !lab.ownSmells.shown;
  // where smells.md is: the watched project folder, then the file's path in it (the helper's, with / separators)
  const joinPath = (dir, rel) => {
    const sep = dir.includes("\\") ? "\\" : "/";
    return dir.replace(/[\\/]+$/, "") + sep + rel.replace(/\//g, sep);
  };
  $: smellsDir = $helper.data?.project?.path || "";
  $: smellsFull = smellsDir ? joinPath(smellsDir, $helper.data?.smells?.path || "smells.md") : "smells.md";
  let ownSmellsNote = "";
  let checkingOwn = false;
  const showBoard = async () => {
    checkingOwn = true;
    const data = await refreshHelper(); // smells.md as it is on disk now
    checkingOwn = false;
    const { count, enough } = ownSmellsListed(lab.ownSmells.start, data?.smells?.content);
    if (!enough) {
      ownSmellsNote =
        `smells.md has ${count} new line${count === 1 ? "" : "s"} so far. ` +
        `List at least ${MIN_OWN_SMELLS} smells of your own, save the file, then try again.`;
      return;
    }
    gameState.labShowBoard(count);
    tickN++;
    report();
  };
  const skipOwnSmells = () => {
    if (!confirm("Show the coach's smell board without listing your own smells first?")) return;
    gameState.labShowBoard();
    tickN++;
    report();
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
  // not in a Develop step: the lab's coach reviews refactorings, and would call a behaviour change broken
  $: if (coached && snapshot && lab && !lab.develop && !gameState.finished && (buildFailed(snapshot) || !staleResults(snapshot)))
    lookAt(snapshot);
  const lookAt = async (current, { rescue = false } = {}) => {
    const now = Date.now() / 1000;
    // keyed by round, not phase: Test and Commit don't each need a Look of their own
    if (!rescue && !nextStepsDue(lastLook, lab.round, current, now)) return;
    if (!rescue) lastLook = { step: lab.round, run: runMark(current), code: codeKey(current), at: now };
    const round = lab.round;
    const { answer } = await askLab({
      problem: labProblem,
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
  $: broke =
    !!review && !lab?.develop && !review.behaviour_kept && !!snapshot && (buildFailed(snapshot) || failingTests(snapshot).length > 0);

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
  $: finished = (tickN, gameState.finished);

  // ---- The worksheet (worksheet.js): the README's numbered steps, one per
  // round. The step's details come from the README as it is now; which step,
  // and its hat, from the game (gameState.labGotoStep, labDone).
  $: worksheet = parseWorksheet($helper.data?.readme?.content);
  $: steps = lab?.steps || [];
  $: stepIndex = steps.findIndex((s) => s.id === lab?.step);
  $: currentStep = worksheet.steps.find((s) => s.id === lab?.step) || steps[stepIndex] || null;
  $: worksheetDone = steps.length > 0 && lab?.step === null;
  $: smellsSection = worksheet.sections.find((s) => s.number === 1);
  // the coach gets the step list and the current step, not the whole README
  $: labProblem = steps.length
    ? worksheetProblem(worksheet.steps.length ? worksheet : { steps }, lab.step)
    : resolveProblem(gameState.problem, $helper.data);
  $: canMoveStep = (phase === "refactor" || phase === "develop") && !helperMissing;
  const gotoStep = (id) => {
    gameState.labGotoStep(id);
    tickN++;
    report();
  };
  const sentence = (text) => (text ? text[0].toUpperCase() + text.slice(1) + (/[.?!:]$/.test(text) ? "" : ".") : "");
  $: phase = lab?.phase || "refactor";
  // the commit's example names this round's refactoring when the coach saw one
  // (lab.roundMove is saved, so it survives a refresh; the coach's `look` doesn't)
  $: card =
    phase === "commit" && lab?.develop
      ? { ...LAB_CARDS.commit, driver: LAB_CARDS.develop.commit }
      : phase === "commit" && lab?.roundMove
      ? { ...LAB_CARDS.commit, driver: LAB_CARDS.commit.driver.replace("Extract Function", lab.roundMove) }
      : LAB_CARDS[phase];
  // a Develop round is DEVELOP ---> COMMIT
  $: shownPhases = lab?.develop ? ["develop", "commit"] : LAB_PHASES;
  $: snapshot = $helper.status === "connected" ? snapshotOf($helper.data) : null;
  $: status = snapshot && lab ? labStatus(phase, lab.base, snapshot) : null;
  $: helperMissing = $helper.status !== "connected";
  $: locked = helperMissing || !status?.goalMet;
  // tickN: gameState mutates in place, so the roles swapped at a commit need it to show
  $: driver = (tickN, gameState.players[gameState.driver]);
  $: navigators = (tickN, gameState.players.filter((p, i) => p && i !== gameState.driver));

  // "In a mess?" undone back to the last commit in Test or Commit: there's no
  // refactoring left to test or commit, so the round starts again at Refactor.
  // A Develop step waits for its first change; its commit may be tests alone.
  $: if (
    snapshot &&
    lab &&
    (phase === "test" || phase === "commit") &&
    !lab.forced &&
    !(lab.develop ? codeChanged : productionChanged)(lab.base, snapshot)
  )
    restartRound();
  const restartRound = () => {
    gameState.labRestartRound();
    tickN++;
  };

  // ---- The card's one "do this now" (DoNow): the first problem on the
  // to-do list, else the phase's task, else (all ticked) Done.
  $: problem = status?.lines.find((l) => l.ok === false);
  // listing their own smells is the whole task for now: the refactor to-do
  // list, Done and Develop wait until the board is shown (or skipped)
  $: smellsFirst = !problem && boardHidden && phase === "refactor" && !status?.goalMet;
  $: doNow = problem
    ? phase === "commit" && problem.reason
      ? `${problem.text}. ${problem.reason}`
      : problem.reason || problem.text
    : smellsFirst
    ? "Find the smells yourselves first: read the code together and write each smell, with its line number, in smells.md."
    : currentStep && (phase === "refactor" || phase === "develop") && !status?.goalMet
    ? `Step ${currentStep.id}: ${sentence(stepHeadline(currentStep))}`
    : status?.goalMet
    ? "Everything is ticked: click Done below."
    : card.driver;
  $: navigatorNumber = (tickN, gameState.players).findIndex((p, i) => p && i !== gameState.driver) + 1;
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

  const done = async (options = {}) => {
    if (waiting || helperMissing) return;
    waiting = true;
    if (await refreshHelper()) await tick(); // the code as it is on disk now
    waiting = false;
    if (!status?.goalMet) {
      whyOpen = true; // a locked Done answers with the reasons
      return;
    }
    gameState.labDone(snapshot, options);
    tickN++;
    report();
  };

  // ---- "Why can't we go on?": each unticked item with how the app checked
  // it, and "Go on anyway" when the app has it wrong (an override, for the teacher)
  let whyOpen = false;
  $: unticked = status?.lines.filter((l) => l.ok !== true) || [];
  $: phase, (whyOpen = false); // a new phase: its own reasons, asked for afresh
  $: if (!locked) whyOpen = false;
  // options as for Done: {stayOnStep} for a worksheet step that takes another commit
  const goOnAnyway = (options = {}) => {
    if (!confirm("Go on anyway? The teacher sees this as an override.")) return;
    gameState.labOverride(snapshot, unticked.map((l) => l.text), options);
    whyOpen = false;
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

  // ---- A Develop step (the worksheet's [Develop] hat): the pair says what
  // will change, and failing or edited tests stop holding them until every
  // test passes again. Offered in Refactor and Test, and opened up when a
  // failing or edited test is what holds them.
  // (a worksheet's [Develop] steps start in Develop by themselves: no offer then)
  $: canDevelop = (phase === "refactor" || phase === "test") && !helperMissing && !steps.length;
  $: heldByTests = !!problem?.testsHold;
  let developOpen = false;
  let developWhat = "";
  $: developReady = developWhat.trim().length >= 5;
  const startDevelop = () => {
    if (!canDevelop || !developReady) return;
    gameState.labDevelop(developWhat);
    developOpen = false;
    developWhat = "";
    tickN++;
    report();
  };
  const cancelDevelop = () => {
    if (!confirm("Back to refactoring? Failing or edited tests will hold you again.")) return;
    gameState.labCancelDevelop();
    tickN++;
    report();
  };

  const finish = () => {
    if (!confirm("Finish the lab? This ends the game.")) return;
    gameState.finish();
    tickN++;
    report();
  };
</script>

<div class="labLine" role="img" aria-label="Round {lab?.round || 1}, {card?.title}">
  {#each shownPhases as p, i}
    <span class="ph" class:on={!finished && p === phase}>[{LAB_CARDS[p].title.toUpperCase()}]</span
    >{#if i < shownPhases.length - 1}<span class="arrow"> ---> </span>{:else}<span class="arrow" title="Swap roles, next round"> --↺</span>{/if}
  {/each}
  <span class="round">{finished ? "  Finished" : `  Round ${lab?.round || 1}`}</span>
</div>

{#if finished}
  <div class="labCard" transition:fade>
    <p class="title aoc-heading">Lab finished</p>
    <Reflection {gameState} on:save={report} />
  </div>
{:else if lab}
  <div class="labCard phase-{phase}" transition:fade>
    <p class="title aoc-heading">Round {lab.round}: {card.title}</p>
    {#if currentStep && !boardHidden}
      <p class="stepLine">
        <strong>Step {currentStep.id}</strong>
        [{currentStep.hat === "develop" ? "Develop" : "Refactor"}]
        {#if currentStep.optional}<span class="optional">{currentStep.optional}</span>{/if}
        <span class="muted">· step {stepIndex + 1} of {steps.length}</span>
      </p>
    {/if}
    <!-- One card, one thing to do now: this line, then what blocks it, the
         to-do list and Done. Everything else is folded away at the bottom. -->
    <DoNow
      {driver}
      driverNumber={(tickN, gameState.driver) + 1}
      action={doNow}
      {navigators}
      {navigatorNumber}
      navigatorAction={smellsFirst ? "Read along, and point out any smell the driver misses." : card.navigator}
      held={!!problem || broke}
    >
      <HowTo item={problem || card} />
      {#if lab.develop && !currentStep}
        <p class="developSaid">You're changing: <strong>{lab.develop}</strong></p>
      {/if}
      {#if currentStep?.hat === "develop" && phase === "develop"}
        <p class="developSaid">
          A <strong>Develop</strong> step: it changes what the code does, so tests may fail and you may change them.
          The game doesn't hold you for that until every test passes again.
        </p>
      {/if}
      {#if phase === "refactor" && nextSmell && !boardHidden && !steps.length}
        <p class="nextSmell">
          Next on the smell board: <strong>{nextSmell.where}:</strong> {nextSmell.what}
          <span class="muted">(<Glossary name={nextSmell.refactoring} />)</span>
        </p>
      {/if}
      {#if phase === "commit" && (look?.commit_message || lab.commitMessage)}
        <p class="muted">Suggested commit message: <strong>{look?.commit_message || lab.commitMessage}</strong></p>
      {/if}
    </DoNow>

    {#if currentStep && !boardHidden}
      <Fold title="Step {currentStep.id} in full" note="from the README" open={true}>
        <div class="stepBody">
          {#if currentStep.body}{@html renderMarkdown(currentStep.body)}{:else}<p>{@html renderMarkdown(currentStep.title)}</p>{/if}
        </div>
        <p class="stepNav">
          {#if stepIndex > 0}
            <button class="quiet" disabled={!canMoveStep} on:click={() => gotoStep(steps[stepIndex - 1].id)}
              >◀ Back to step {steps[stepIndex - 1].id}</button
            >
          {/if}
          {#if stepIndex < steps.length - 1}
            <button class="quiet" disabled={!canMoveStep} on:click={() => gotoStep(steps[stepIndex + 1].id)}
              >Skip to step {steps[stepIndex + 1].id} ▶</button
            >
          {/if}
          {#if !canMoveStep}<span class="muted">Commit, or undo, this round's change first.</span>{/if}
        </p>
      </Fold>
    {:else if worksheetDone}
      <div class="ownSmells">
        <p>
          <strong>That's every step on the worksheet.</strong> {lab.rounds} round{lab.rounds === 1 ? "" : "s"} committed.
          Do the Wrap-up in the README, then finish the lab (under More).
        </p>
        <p class="stepNav">
          <button class="quiet" disabled={!canMoveStep} on:click={() => gotoStep(steps[steps.length - 1].id)}
            >◀ Back to step {steps[steps.length - 1].id}</button
          >
        </p>
      </div>
    {/if}

    {#if broke}
      <div class="brokeBox">
        <p class="marker">That change broke something: undo the last change</p>
        {#if review.note}<p>What probably broke: {review.note}</p>{/if}
        <HowTo item={{ howto: "undo" }} />
      </div>
    {/if}

    {#if !helperMissing}
      <BuildError errors={buildErrors} coachHelp={buildHelp} />
    {/if}
    {#if helperMissing}
      <p class="doneHint locked">Waiting for the helper</p>
    {:else if status?.lines.length && !smellsFirst}
      <ul class="todo">
        {#each status.lines as line}
          <li class:done={line.ok === true}>
            <span class="box" aria-label={line.ok === true ? "done" : "not done"}>{line.ok === true ? "[✓]" : "[✖]"}</span>
            <span>
              {tailor(line.text, $ide)}
              {#if line.reason}<span class="reason">{tailor(line.reason, $ide)}</span>{/if}
              <HowTo item={line} />
            </span>
          </li>
        {/each}
      </ul>
    {/if}
    {#if snapshot && phase !== "commit" && !smellsFirst}
      <PredictBox {gameState} {snapshot} navigator={navigators[0]} />
      <MessGuide mode="refactor" {phase} uncommitted={uncommittedFiles(snapshot)} failing={outcomeOf(snapshot) === "red"} />
    {/if}
    {#if !smellsFirst}
    <div class="actions">
      {#if waiting}
        <button disabled>Checking<WaitingDots /></button>
      {:else}
        {#if phase === "commit" && currentStep}
          <!-- a worksheet step can take several commits (e.g. one kind of magic number each) -->
          <button class:lockedDone={locked} aria-disabled={locked} on:click={() => done()}
            >{stepIndex < steps.length - 1 ? `Done: committed, on to step ${steps[stepIndex + 1].id}` : "Done: committed, last step"}</button
          >
          <button class="quiet" class:lockedDone={locked} aria-disabled={locked} on:click={() => done({ stayOnStep: true })}
            >Committed, but step {currentStep.id} isn't finished yet</button
          >
        {:else}
          <button class:lockedDone={locked} aria-disabled={locked} on:click={() => done()}>{card.done}</button>
        {/if}
        {#if locked && !helperMissing && !whyOpen}
          <button class="quiet" on:click={() => (whyOpen = true)}>Why can't we go on?</button>
        {/if}
      {/if}
    </div>
    {#if whyOpen && !helperMissing}
      <div class="whyBox">
        <p><strong>Why the app won't let you go on yet:</strong></p>
        <ul>
          {#each unticked as line}
            <li>
              <strong>{tailor(line.text, $ide)}.</strong>
              {tailor(line.why || line.reason || "Not done yet.", $ide)}
            </li>
          {/each}
        </ul>
        <p class="muted">
          If you've done it and the app hasn't noticed, save your files and wait a few seconds. If it still has it
          wrong, you can go on anyway: the teacher sees that you did.
        </p>
        <p class="developActions">
          {#if phase === "commit" && currentStep}
            <button class="quiet" on:click={() => goOnAnyway()}
              >Go on anyway, {stepIndex < steps.length - 1 ? `on to step ${steps[stepIndex + 1].id}` : "last step"}</button
            >
            <button class="quiet" on:click={() => goOnAnyway({ stayOnStep: true })}
              >Go on anyway, step {currentStep.id} isn't finished yet</button
            >
          {:else}
            <button class="quiet" on:click={() => goOnAnyway()}>Go on anyway</button>
          {/if}
          <button class="quiet" on:click={() => (whyOpen = false)}>Close</button>
        </p>
      </div>
    {/if}
    {#if phase === "develop" && !steps.length}
      <p class="finishRow">
        <button class="quiet" on:click={cancelDevelop}>Not changing behaviour after all: back to Refactor</button>
      </p>
    {:else if canDevelop}
      <div class="developRow" class:held={heldByTests}>
        {#if !developOpen && !heldByTests}
          <button class="quiet" on:click={() => (developOpen = true)}>Changing what the code does on purpose?</button>
        {:else}
          <p>
            <strong>Changing what the code does on purpose?</strong> That's a Develop step, not a refactoring.
            Tests that check the old behaviour will fail, and you'll change them. Say what will change, and the
            lab stops holding you for failing or changed tests. When every test passes again, you commit and go
            back to refactoring.
          </p>
          <label>
            What will the code do differently?
            <input
              type="text"
              maxlength="200"
              placeholder="e.g. play any legal move, not just the first one"
              bind:value={developWhat}
              on:keydown={(e) => e.key === "Enter" && startDevelop()}
            />
          </label>
          <p class="developActions">
            <button disabled={!developReady} on:click={startDevelop}>We expect tests to fail: start the Develop step</button>
            {#if !heldByTests}<button class="quiet" on:click={() => (developOpen = false)}>Never mind</button>{/if}
          </p>
        {/if}
      </div>
    {/if}
    {/if}
    <!-- a clear board makes switching to TDD the next thing to do; until then it waits under More -->
    {#if boardClear && !steps.length}
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
    {#if boardHidden}
      <div class="ownSmells">
        <p>
          <strong>Smells first.</strong> The coach has a smell board ready, but find the smells yourselves
          first: read the code together and write each smell, with its line number, in
          <strong>{smellsFull}</strong>{#if !$helper.data?.smells} (not found yet){/if}. Save it, then compare your list with the
          coach's.
        </p>
        {#if smellsSection?.intro}
          <Fold title="Section {smellsSection.number}: {smellsSection.title}" note="from the README">
            <div class="stepBody">{@html renderMarkdown(smellsSection.intro)}</div>
          </Fold>
        {/if}
        {#if ownSmellsNote}<p class="reason">{ownSmellsNote}</p>{/if}
        <p class="developActions">
          <button disabled={checkingOwn || helperMissing} on:click={showBoard}
            >{checkingOwn
              ? "Reading smells.md…"
              : steps.length
              ? `We've listed our smells: on to step ${steps[0].id}`
              : "We've listed our smells: show the coach's board"}</button
          >
          <button class="quiet" on:click={skipOwnSmells}>Skip</button>
        </p>
      </div>
    {:else if orientLoading}
      <p class="muted">The coach is reading your code for smells<WaitingDots label="Reading your code" /></p>
    {:else if board.length}
      <Fold
        title={steps.length ? "The coach's smell board" : "Smell board"}
        note={smellsLeft ? `${smellsLeft} of ${board.length} left` : "clear ✓"}
      >
        <ul class="board">
          {#each shownSmells as smell}
            <li class:resolved={smell.resolved}>
              <span class="box">{smell.resolved ? "[✓]" : "[ ]"}</span>
              <span><strong>{smell.where}:</strong> {smell.what} <span class="muted">(<Glossary name={smell.refactoring} />{smell.from_readme ? "" : ", extra"})</span></span>
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

    {#if phase === "refactor" && hintText?.question && !boardHidden}
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
            <Glossary name={review.refactoring} />{review.refactoring ? ", " : ""}{EFFECT_TEXT[review.effect]}.
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
        <p class="muted">
          Refactorings for this lab: {#each lab.refactorings as name, i}{#if i}, {/if}<Glossary {name} />{/each}
        </p>
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

  .ownSmells {
    margin-top: 0.8em;
    padding: 0.3em 0.8em;
    border: 1px solid var(--refactoring-blue);
    font-size: 0.9em;
  }

  .ownSmells p {
    margin: 0.3em 0;
  }

  .whyBox {
    margin-top: 0.8em;
    padding: 0.3em 0.8em;
    border: 1px solid var(--refactoring-blue);
    font-size: 0.9em;
  }

  .whyBox p,
  .whyBox li {
    margin: 0.3em 0;
  }

  .stepLine {
    margin: 0.1em 0 0.3em 0;
    color: var(--refactoring-blue);
  }

  .optional {
    margin-left: 0.4em;
    padding: 0 0.4em;
    border: 1px solid var(--amber);
    color: var(--amber);
    font-size: 0.85em;
  }

  .stepBody {
    font-size: 0.9em;
    overflow-x: auto;
  }

  .stepBody :global(pre) {
    overflow-x: auto;
    padding: 0.4em;
    background: var(--bg);
  }

  .stepBody :global(blockquote) {
    margin: 0.4em 0;
    padding-left: 0.6em;
    border-left: 2px solid var(--refactoring-blue);
  }

  .stepBody :global(table) {
    border-collapse: collapse;
  }

  .stepBody :global(th),
  .stepBody :global(td) {
    padding: 0.1em 0.5em;
    border: 1px solid var(--opacity-50);
    text-align: left;
  }

  .stepNav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6em;
    align-items: center;
    font-size: 0.9em;
  }

  .developSaid {
    margin: 0.3em 0;
    font-size: 0.9em;
  }

  .developRow {
    margin-top: 0.6em;
    font-size: 0.9em;
  }

  .developRow.held {
    padding: 0.3em 0.8em;
    border: 1px solid var(--amber);
  }

  .developRow p {
    margin: 0.3em 0;
  }

  .developRow input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.2em;
  }

  .developActions {
    display: flex;
    gap: 0.6em;
    flex-wrap: wrap;
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
