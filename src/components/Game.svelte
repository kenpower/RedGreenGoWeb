<script>
  import Step from "./Step.svelte";
  import Iteration from "./Iteration.svelte";
  import { fade, fly } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  import { helper } from "../helper.js";
  import { isCoached, askCoach, resolveProblem, toneOf, shouldShow } from "../coach.js";
  import { checkRules, snapshotOf } from "../rules.js";
  import { hintFor } from "../content/hints.js";

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
  let tone = "";
  let advice = null; // the coach's {driver, navigator} for this step, from the last advancing verdict
  let nextTest = ""; // the coach's suggested next test, shown as the hint on Red
  let likelyFinished = false;
  let finishState = "idle"; // "idle" | "asking" | "disagreed"
  let askedWith = null; // the snapshot (as JSON) the pair last asked about while held

  $: step = gameState.getStep();
  $: snapshot = $helper.status === "connected" ? snapshotOf($helper.data) : null;
  $: canAskAgain = held && JSON.stringify(snapshot) !== askedWith;

  // The code at the start of the game is the baseline for the first Red.
  $: if (snapshot && !gameState.before && gameState.stepNumber === 1 && !gameState.finished)
    gameState.setBaseline(snapshot);

  $: instructions = instructionsFor(step, held, verdict, advice);
  const instructionsFor = (step, held, verdict, advice) => {
    if (!step) return { driver: "", navigator: "" };
    const coachSays = held ? verdict : advice && { driver_action: advice.driver, navigator_action: advice.navigator };
    return {
      driver: coachSays?.driver_action || step.bodyText,
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
    held = false;
    verdict = null;
    findings = [];
    askedWith = null;
    finishState = "idle";
    feedback = carry.feedback || "";
    tone = carry.tone || "";
    advice = carry.advice || null;
  };

  const hold = (stepVerdict, stepFindings) => {
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
      nextTest = v.next_test || nextTest;
      return advance(
        { feedback: v.note, tone: "red", advice: { driver: v.driver_action, navigator: v.navigator_action } },
        true
      );
    }
    advance({
      feedback: show ? v.note : "",
      tone: show ? TONES[toneOf(v)] : "",
      advice: { driver: v.driver_action, navigator: v.navigator_action },
    });
  };

  const ask = (phase, ruleFindings) =>
    askCoach({
      phase,
      problem: resolveProblem(gameState.problem, $helper.data),
      before: gameState.before,
      after: snapshot,
      ruleFindings: ruleMessages(ruleFindings),
      history: gameState.history,
    });

  const done = async () => {
    const phase = gameState.state.id;
    if (!CHECKED_PHASES.includes(phase)) return advance();

    const stepFindings = checkRules(phase, gameState.before, snapshot);
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

  const finishGame = () => {
    gameState.finish();
    gameState = gameState;
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
    switch (event.detail) {
      case "done":
      case "askAgain":
        return done();
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
  $: backToRedCount = gameState.iterations.reduce((sum, i) => sum + (i.backToRed || 0), 0);
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
        {tone}
        {feedback}
        {findings}
        coach={verdict}
        {canAskAgain}
        {finishState}
        {likelyFinished}
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
