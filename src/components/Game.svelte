<script>
  import Step from "./Step.svelte";
  import Iteration from "./Iteration.svelte";
  import { fade, fly } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  import Solutions from "./Solutions.svelte";
  import ModalContainer from "./ModalContainer.svelte";

  const dispatch = createEventDispatcher();

  export let gameState;

  let solutions;
  let solutionsReady = false;
  let showFinalSolution = false;
  $: finalSolutionHTML =
    solutionsReady && gameState.finished
      ? solutions.getStepText(gameState.totalIterations, "refactor")
      : "";

  const nextStep = () => {
    gameState.nextStep();
    gameState = gameState;
  };

  const pairNames = (players) => {
    const names = players.filter((p) => p);
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  };
</script>

<div class="iterations">
  {#each gameState.iterations as i}
    <Iteration iterationCounter={i.index} phase={i.phase} />
  {/each}
</div>
<div>
  {#if gameState.getStep()}
    <div transition:fade>
      <Step step={gameState.getStep()} on:interact={nextStep} />
    </div>
  {:else if gameState.finished}
    <div class="finished" in:fly={{ delay: 300, y: 400, duration: 1000 }}>
      <p class="title">Kata complete!</p>
      <p>
        {pairNames(gameState.players)} worked through all
        {gameState.totalIterations} iterations of the Red, Green, Refactor cycle,
        swapping driver and navigator {gameState.totalIterations} times.
      </p>
      <p>
        You have built FizzBuzz one small, tested step at a time. Compare your
        final code with our final solution. How is it different?
      </p>
      <div class="actions">
        {#if finalSolutionHTML}
          <button on:click={() => (showFinalSolution = true)}
            >See our final solution</button
          >
        {/if}
        <button on:click={() => dispatch("restart")}>Start again</button>
      </div>
      <ModalContainer bind:isOpenModal={showFinalSolution}>
        <div class="solution">
          {@html finalSolutionHTML}
        </div>
      </ModalContainer>
    </div>
  {/if}
</div>

<Solutions bind:this={solutions} bind:dataReady={solutionsReady} />

<style>
  .iterations {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-evenly;
  }

  .finished {
    border: 2px solid var(--refactoring-blue);
    border-radius: 5px;
    background-color: var(--refactoring-blue-hint);
    margin-top: 10px;
    padding-bottom: 0.5em;
  }

  .finished p {
    padding: 0 1em;
  }

  .actions {
    display: flex;
    justify-content: space-evenly;
  }

  .solution {
    background: white;
    text-align: left;
  }

  .finished .title {
    font-weight: bold;
    font-size: 1.3em;
    padding: 4px;
    margin: 0;
    background-color: var(--refactoring-blue-muted);
  }
</style>
