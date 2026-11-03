<script>
  // The navigator's prediction (predict.js): asked when a run is coming, settled
  // by the next fresh run of the same code. Optional: Skip, or just run the tests.
  import { outcomeOf, predictionDue, GUESSES } from "../predict.js";
  import { runMark, codeKey } from "../content/steps.js";

  export let gameState;
  export let snapshot = null;
  export let navigator = "Navigator";
  export let step = 0; // gameState.stepNumber, passed in: gameState changes in place

  let tick = 0; // gameState changes in place: bumped so the lines below recompute
  $: mark = runMark(snapshot);
  $: if (snapshot && gameState.settlePrediction(mark, outcomeOf(snapshot), codeKey(snapshot))) tick++;
  $: pending = (tick, gameState.prediction);
  // the result only while it's about the latest run in this step: not after a
  // Skip, a new change or the next step, when it reads as if about those
  $: last = (tick, gameState.lastPrediction);
  $: shownLast = last && last.run === mark && (last.step === undefined || last.step === step) ? last : null;
  // asked once per run: a guess (or a skip) at this mark answers it
  $: answered = pending?.mark === mark;
  $: asking = predictionDue(snapshot) && !answered;

  const choose = (guess) => {
    gameState.predict(guess, mark, { code: codeKey(snapshot), by: navigator });
    tick++;
  };
</script>

{#if asking}
  <div class="predict">
    <p><span class="label">{navigator}:</span> before you run the tests, what will happen?</p>
    <div class="choices">
      <button class="green" on:click={() => choose("green")}>{GUESSES.green}</button>
      <button class="red" on:click={() => choose("red")}>{GUESSES.red}</button>
      <button class="quiet" on:click={() => choose(null)}>Skip</button>
    </div>
  </div>
{:else if answered && pending.guess}
  <p class="predict"><span class="label">{pending.by || navigator} predicts:</span> {GUESSES[pending.guess].toLowerCase()}. Run the tests and see.</p>
{:else if shownLast}
  <p class="predict result" class:right={shownLast.right}>
    {#if shownLast.right}
      Prediction right ✓: {GUESSES[shownLast.outcome].toLowerCase()}, as {shownLast.by || navigator} said.
    {:else}
      Prediction wrong: {shownLast.by || navigator} said {GUESSES[shownLast.guess].toLowerCase()}, it was {GUESSES[shownLast.outcome].toLowerCase()}. What surprised you?
    {/if}
  </p>
{/if}

<style>
  .predict {
    margin: 0.5em 0;
    padding-left: 0.6em;
    border-left: 2px solid var(--star);
    overflow-wrap: anywhere;
  }

  .predict p {
    margin: 0.2em 0;
  }

  .label {
    color: var(--star);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3em 0.8em;
  }

  .choices button {
    margin: 0;
  }

  .green {
    color: var(--coding-green);
  }

  .red {
    color: var(--testing-red);
  }

  .quiet {
    color: var(--text-muted);
  }

  .result {
    color: var(--amber);
    border-left-color: var(--amber);
  }

  .result.right {
    color: var(--coding-green);
    border-left-color: var(--coding-green);
  }
</style>
