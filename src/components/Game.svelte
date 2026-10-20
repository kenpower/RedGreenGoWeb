<script>
  import Step from "./Step.svelte";
  import Iteration from "./Iteration.svelte";
  import { fade, fly } from "svelte/transition";
  import { createEventDispatcher, tick } from "svelte";
  import { helper, refreshHelper, BLOCKED_HELP } from "../helper.js";
  import { isCoached, askCoach, resolveProblem, toneOf, shouldShow, sendProgress, expectedFor } from "../coach.js";
  import {
    checkRules, snapshotOf, startState, failingTests, uncommittedFiles, noRepo, liveStatus, codeFirstAdvice,
  } from "../rules.js";
  import { hintFor } from "../content/hints.js";
  import { guideFor, unlockAction, GUIDE_CYCLES } from "../guide.js";
  import { rescueOffer } from "../gameState.js";

  const dispatch = createEventDispatcher();

  export let gameState;

  const TONES = { hold: "red", advice: "amber", good: "green" };
  const CHECKED_PHASES = ["red", "green", "refactor"];

  // What the step card shows. None of this is saved: a reload starts the
  // current step afresh, which is fine since Done checks again anyway.
  let waiting = false;
  let held = false;
  let verdict = null; // the coach's verdict for this step
  let findings = []; // rule findings for this step
  let feedback = ""; // one line carried over from the previous step
  let feedbackWho = ""; // "Coach" when that line is the coach's note; "" for the game's own
  let tone = "";
  let advice = null; // the coach's {driver, navigator} for this step, from the last advancing verdict
  let nextTest = ""; // the coach's suggested next test, shown as the hint on Red
  let likelyFinished = false;
  let finishState = "idle"; // "idle" | "asking" | "disagreed"
  let askedWith = null; // the snapshot (as JSON) the pair last asked about while held

  // Stuck on one step: Done/Ask again that ended held, counted in gameState.
  // Mirrored here (reassigning gameState would re-key the step card). Only
  // the pair's own clicks count, not the automatic re-checks.
  let attempts = gameState.stuckAttempts;
  let attemptPending = false; // the current done() came from the pair's click
  let rescue = null; // {why, code} once the coach has shown the code for this step
  const countAttempt = () => {
    if (!attemptPending) return;
    attemptPending = false;
    gameState.noteHeld();
    attempts = gameState.stuckAttempts;
  };
  $: offer = step && CHECKED_PHASES.includes(step.stateName) && !rescue ? rescueOffer(attempts, isCoached($helper)) : "";

  $: step = gameState.getStep();
  $: snapshot = $helper.status === "connected" ? snapshotOf($helper.data) : null;
  $: canAskAgain = held && JSON.stringify(snapshot) !== askedWith;

  // Live steps: the step's goal, checked on every helper update with the real
  // test names (rules.liveStatus). When the rules are enforced or the coach
  // is on ("gated"), Done is locked until the goal is met; otherwise the
  // unmet lines are only amber warnings. No helper: the static card text.
  $: gated = gameState.enforceRules || isCoached($helper);
  $: live = step && snapshot ? liveStatus(step.stateName, gameState.before, snapshot) : null;
  $: liveLines = live ? (live.backToRed && !gated ? [{ text: live.backToRed, ok: false }, ...live.lines] : live.lines) : [];
  $: doneLocked = (!!live && gated && !live.goalMet) || helperMissing;
  // cycles 1–2: numbered steps, ticked live; [] from cycle 3
  $: guide = step ? guideFor(step.stateName, step.cycle, gameState.before, snapshot, live, { locked: doneLocked }) : [];
  // Advice lines, never a hold: vague test names, and in the first Red, code
  // written before any test calls it. Also passed to the coach, marked as advice.
  $: liveAdvice = live
    ? [...(step.stateName === "red" && step.cycle === 1 ? codeFirstAdvice(snapshot) : []), ...live.advice]
    : [];

  // The steps need the helper: without it there is nothing to check, so Red,
  // Green and Refactor wait for it (Swap doesn't). They carry on by themselves
  // once it reconnects.
  const HELPER_MISSING = "Helper disconnected: start rgg_server.py in your project folder to carry on";
  $: helperMissing = !!step && step.stateName !== "swap" && $helper.status !== "connected";

  // Done never refuses silently: say what's still missing, kept up to date
  // from the live lines until the goal is met or the step changes.
  let refused = false;
  $: firstUnmet = live?.lines.find((l) => l.ok !== true)?.text || "";
  $: notYet = refused && !helperMissing
    ? shownStartState
      ? "Not yet: sort out the check above first"
      : firstUnmet
        ? "Not yet: " + firstUnmet
        : ""
    : "";
  $: if (refused && live?.goalMet && !shownStartState) refused = false;
  $: shownFeedback = helperMissing ? ($helper.status === "blocked" ? BLOCKED_HELP : HELPER_MISSING) : notYet || feedback;
  $: shownWho = helperMissing || notYet ? "" : feedbackWho;
  $: shownTone = helperMissing || notYet ? "red" : tone;

  // Entering Green with nothing failing means Red never had a failing test:
  // back to Red automatically (same driver, counted as a back to Red).
  // Checked once per Green step; only when gated, otherwise it's a warning line.
  let greenEntryChecked = 0;
  $: if (step?.stateName === "green" && live && gated && greenEntryChecked !== step.stepNumber) enterGreen(live);
  const enterGreen = (status) => {
    greenEntryChecked = step.stepNumber;
    if (status.backToRed) advance({ feedback: status.backToRed, tone: "red" }, true);
  };

  // Before a Red, check where the code is (rules.startState), live as the
  // helper's data arrives: tests already failing, a broken build, or no
  // results yet hold the Red until sorted. A clean start becomes the
  // baseline for the Red's rule check. Without the helper, Red is as normal.
  // Uncommitted work holds the Red too, when the rules are enforced or the
  // coach is on; otherwise it's a warning captured as the Red starts (the new
  // test itself makes the source dirty, so a live list would always warn).
  let freshStart = false; // the pair said the one failing test isn't their Red test
  let commitWarning = []; // uncommitted files when this Red started, not enforced
  $: startChecked = gameState.startChecked;
  $: requireCommit = gameState.enforceRules || isCoached($helper);
  $: startGate =
    step?.stateName === "red" && !startChecked && snapshot ? startState(snapshot, { requireCommit }) : "";
  $: if (startGate === "clean") clearStart();
  $: shownStartState = startGate === "clean" ? "" : startGate;
  $: failing = shownStartState ? failingTests(snapshot) : [];
  $: buildErrors = shownStartState === "build_failed" ? snapshot.build?.errors || [] : [];
  $: uncommitted = shownStartState === "uncommitted" ? uncommittedFiles(snapshot) : commitWarning;
  $: repoMissing = step?.stateName === "red" && noRepo(snapshot);

  const clearStart = () => {
    commitWarning = requireCommit ? [] : uncommittedFiles(snapshot);
    gameState.takeBaseline(snapshot); // once per Red: a later "clean" never re-takes it
    startChecked = true;
    freshStart = false;
  };

  // "Yes, use it": the failing test is this Red's test, so Red is done.
  const useExisting = () => {
    if (startGate !== "one_failing") return;
    clearStart();
    advance();
  };

  $: instructions = instructionsFor(step, held, verdict, advice, live, doneLocked, snapshot);
  // `snapshot` is passed only so Svelte re-runs this when the code changes
  const instructionsFor = (step, held, verdict, advice, live, locked, snapshot) => {
    if (!step) return { driver: "", navigator: "" };
    // While Done is locked, or the app's rules hold the step, the lines say
    // what unlocks it, so the card never contradicts the lock. A coach hold
    // keeps the coach's own actions.
    const coachHold = held && verdict;
    if (!coachHold && (locked || held)) {
      const unlock = unlockAction(step.stateName, gameState.before, snapshot, live);
      if (unlock) return unlock;
    }
    const coachSays = held ? verdict : advice && { driver_action: advice.driver, navigator_action: advice.navigator };
    // with the helper, the card names the real test; the static text is the fallback
    const liveDriver =
      step.stateName === "green" && live?.focusTest ? `Make ${live.focusTest} pass with the smallest change.` : "";
    return {
      driver: coachSays?.driver_action || liveDriver || step.bodyText,
      navigator: coachSays?.navigator_action || step.navigatorPrompt,
    };
  };

  $: hint = step?.stateName === "red" && nextTest ? "Try next: " + nextTest : hintFor(step?.stateName, step?.cycle);

  const ruleMessages = (list) => list.map((f) => f.message);

  // Moves on to the next step, or back to Red, carrying one line of feedback.
  // After a checked step the snapshot becomes the "before" for the next
  // step's rule checks; a swap leaves it alone.
  const advance = (carry = {}, backToRed = false) => {
    if (snapshot && CHECKED_PHASES.includes(gameState.state.id)) gameState.setBefore(snapshot);
    if (backToRed) gameState.backToRed();
    else {
      if (gameState.state.id === "red") nextTest = "";
      gameState.nextStep();
    }
    gameState = gameState;
    freshStart = false;
    commitWarning = [];
    hardHold = false;
    held = false;
    verdict = null;
    findings = [];
    askedWith = null;
    finishState = "idle";
    refused = false;
    feedback = carry.feedback || "";
    feedbackWho = carry.who || "";
    rescue = null;
    attempts = gameState.stuckAttempts; // 0 after moving on, kept after a back to Red
    tone = carry.tone || "";
    advice = carry.advice || null;
    report();
  };

  // Records the pair's progress on the coach server after every step change,
  // for grading. Fire and forget: sendProgress never throws, and skips
  // without a class code.
  const report = async () => {
    const progress = gameState.progress();
    // events stay queued until the server has them
    if ((await sendProgress(progress)) && progress.events.length) gameState.ackEvents(progress.events.length);
  };

  const hold = (stepVerdict, stepFindings) => {
    countAttempt();
    held = true;
    verdict = stepVerdict;
    findings = stepFindings;
    tone = "red";
    askedWith = JSON.stringify(snapshot);
  };

  // Without the coach, or when it couldn't answer: the app's own rules.
  const decideByRules = (stepFindings, error = "") => {
    if (stepFindings.length && gameState.enforceRules && snapshot) return hold(null, stepFindings);
    const warnings = ruleMessages(stepFindings).join(" ");
    advance({
      feedback: [error, warnings].filter((s) => s).join(" "),
      tone: warnings || error ? "amber" : "",
    });
  };

  const decideByCoach = (phase, v) => {
    gameState.addHistory(phase, v);
    const show = shouldShow(phase, v);
    likelyFinished = !!v.likely_finished;
    if (v.next_test) nextTest = v.next_test;

    if (v.decision === "redo") return hold(v, []);
    if (v.decision === "back_to_red") {
      countAttempt(); // not progress: still stuck on the same behaviour
      nextTest = v.next_test || nextTest;
      return advance(
        {
          feedback: v.note,
          who: "Coach",
          tone: "red",
          advice: { driver: v.driver_action, navigator: v.navigator_action },
        },
        true
      );
    }
    advance({
      feedback: show ? v.note : "",
      who: "Coach",
      tone: show ? TONES[toneOf(v)] : "",
      advice: { driver: v.driver_action, navigator: v.navigator_action },
    });
  };

  const ask = (phase, ruleFindings, extra = {}) =>
    askCoach({
      ...extra,
      phase,
      expected: expectedFor(phase, phase === "finish" ? null : liveStatus(phase, gameState.before, snapshot), {
        novice: (step?.cycle || 1) <= GUIDE_CYCLES,
      }),
      problem: resolveProblem(gameState.problem, $helper.data),
      before: gameState.before,
      after: snapshot,
      // advice goes along marked as such: the coach may mention it, never hold on it
      ruleFindings: [...ruleMessages(ruleFindings), ...liveAdvice.map((a) => "Advice (not a broken rule): " + a)],
      history: gameState.history,
      gameId: gameState.gameId,
      players: gameState.players,
    });

  // Only one test may fail in Red. When the rules are enforced or the coach
  // is on, the app holds this itself (no coach call) and re-checks live;
  // once it clears, Done carries on by itself. The override still works,
  // and like any override it moves on without asking the coach.
  let hardHold = false;
  const isHardHold = (phase, stepFindings) =>
    phase === "red" &&
    (gameState.enforceRules || isCoached($helper)) &&
    stepFindings.some((f) => f.rule === "one_failing");

  $: if (hardHold && snapshot) recheckHardHold(snapshot);
  const recheckHardHold = (current) => {
    if (waiting) return;
    const stepFindings = checkRules("red", gameState.before, current);
    if (isHardHold("red", stepFindings)) {
      findings = stepFindings;
      return;
    }
    hardHold = false;
    held = false;
    done();
  };

  // Re-reads the code from disk before judging a step, so saves since the
  // last test run or build count (and stale results can be spotted). If the
  // helper can't be reached, the data already in the store is used.
  const refreshSnapshot = async () => {
    if ($helper.status !== "connected") return;
    waiting = true;
    if (await refreshHelper()) await tick(); // let `snapshot` pick up the new data
    waiting = false;
  };

  // A rule hold (no coach verdict) lifts by itself once the rules are met
  // again; the pair then clicks Done to carry on.
  $: if (held && !verdict && !hardHold && snapshot) recheckRuleHold(snapshot);
  const recheckRuleHold = (current) => {
    if (waiting) return;
    const stepFindings = checkRules(gameState.state.id, gameState.before, current);
    if (stepFindings.length) findings = stepFindings;
    else {
      held = false;
      findings = [];
      tone = "";
    }
  };

  const done = async () => {
    const phase = gameState.state.id;
    if (!CHECKED_PHASES.includes(phase)) return advance();

    await refreshSnapshot();
    // the live goal, again with the fresh data: Done is locked until it's met
    const status = snapshot ? liveStatus(phase, gameState.before, snapshot) : null;
    if (gated && status && !status.goalMet) {
      refused = true; // shows "Not yet: …"
      return;
    }
    const stepFindings = checkRules(phase, gameState.before, snapshot);
    if (isHardHold(phase, stepFindings)) {
      hardHold = true;
      return hold(null, stepFindings);
    }
    // The app holds on any broken rule itself, before the coach is asked, so a
    // coach "advance" can never let a broken rule through.
    if (stepFindings.length && gated && snapshot) return hold(null, stepFindings);
    if (!isCoached($helper)) return decideByRules(stepFindings);

    waiting = true;
    askedWith = JSON.stringify(snapshot);
    const { verdict: v, error, stale } = await ask(phase, stepFindings);
    waiting = false;
    if (stale) return;
    // the coach erroring never blocks: fall back to the rules
    if (!v) return decideByRules(stepFindings, error);
    decideByCoach(phase, v);
  };

  // "Show me the code": after RESCUE_AFTER held attempts, the coach shows the
  // code for this step only. The pair types it in themselves.
  const askRescue = async () => {
    const phase = gameState.state.id;
    waiting = true;
    const findingsNow = snapshot ? checkRules(phase, gameState.before, snapshot) : [];
    const { verdict: v, error, stale } = await ask(phase, findingsNow, { rescue: true });
    waiting = false;
    if (stale) return;
    if (!v?.rescue_code) {
      rescue = { why: error || "The coach couldn't show the code this time. Ask your teacher.", code: "" };
      return;
    }
    rescue = { why: v.rescue_why || "", code: v.rescue_code };
    gameState.noteRescue(v.rescue_why);
    report();
  };

  const finishGame = () => {
    gameState.finish();
    gameState = gameState;
    report();
  };

  const finish = async () => {
    if (!isCoached($helper)) {
      if (confirm("Finished? This ends the game.")) finishGame();
      return;
    }
    finishState = "asking";
    waiting = true;
    const { verdict: v, error, stale } = await ask("finish", []);
    waiting = false;
    if (stale) return;
    if (!v) {
      finishState = "idle";
      if (confirm(error + "\n\nFinish anyway?")) finishGame();
      return;
    }
    gameState.addHistory("finish", v);
    if (v.decision === "advance") return finishGame();
    verdict = v;
    if (v.next_test) nextTest = v.next_test;
    finishState = "disagreed";
  };

  const onInteract = (event) => {
    if (waiting) return;
    // without the helper only Swap carries on; the feedback line says why
    if (helperMissing) return;
    switch (event.detail) {
      case "useExisting":
        return useExisting();
      case "startFresh":
        freshStart = startGate === "one_failing";
        return;
      case "done":
      case "askAgain":
        if (shownStartState) {
          refused = true; // the start check is still holding this Red
          return;
        }
        attemptPending = true; // a hold from this click counts as an attempt
        return done().finally(() => (attemptPending = false));
      case "rescue":
        if (offer === "show") return askRescue();
        return; // no coach: the button only says to ask the teacher
      case "override":
        gameState.override();
        return advance();
      case "finish":
        return finish();
      case "finishAnyway":
        gameState.override();
        return finishGame();
    }
  };

  const pairNames = (players) => {
    const names = players.filter((p) => p);
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  };

  $: cycles = gameState.completedCycles();
  $: backToRedCount = gameState.backToRedCount();
</script>

<div class="iterations">
  {#each gameState.iterations as i}
    <Iteration iterationCounter={i.index} phase={i.phase} backToRed={i.backToRed} />
  {/each}
</div>
<div>
  {#if step}
    <div transition:fade>
      <Step
        {step}
        {instructions}
        {hint}
        {waiting}
        {held}
        tone={shownTone}
        feedback={shownFeedback}
        feedbackWho={shownWho}
        {findings}
        coach={verdict}
        {canAskAgain}
        {finishState}
        {likelyFinished}
        startState={shownStartState}
        failingTests={failing}
        {buildErrors}
        {freshStart}
        uncommittedFiles={uncommitted}
        noRepo={repoMissing}
        {liveLines}
        focusTest={live?.focusTest || null}
        goalMet={!!live?.goalMet}
        {doneLocked}
        amberLive={!gated}
        entryProblem={live?.entryProblem || null}
        {liveAdvice}
        {helperMissing}
        {guide}
        rescueOffer={offer}
        {rescue}
        on:interact={onInteract}
      />
    </div>
  {:else if gameState.finished}
    <div class="finished" in:fly={{ delay: 300, y: 400, duration: 1000 }}>
      <p class="title aoc-heading">Finished!</p>
      <p>
        {pairNames(gameState.players)} worked through {cycles}
        {cycles === 1 ? "cycle" : "cycles"} of Red, Green, Refactor.
      </p>
      <ul class="summary">
        <li>Cycles completed: <strong>{cycles}</strong></li>
        <li>Times sent back to Red: <strong>{backToRedCount}</strong></li>
        <li>Times you progressed despite the advice: <strong>{gameState.overrides}</strong></li>
      </ul>
      <p>
        Look back over your tests. Does each one check one behaviour, and do
        their names say what it is?
      </p>
      <div class="actions">
        <button on:click={() => dispatch("restart")}>Start again</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .iterations {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    gap: 6px;
  }

  .finished {
    border: 1px solid var(--star);
    margin-top: 1em;
    padding: 0.8em 1em;
  }

  .summary {
    text-align: left;
  }

  .actions {
    display: flex;
    justify-content: space-evenly;
  }

  .finished .title {
    color: var(--star);
    text-shadow: 0 0 5px var(--star);
    font-size: 1.2em;
  }
</style>
