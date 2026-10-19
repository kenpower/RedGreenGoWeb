<script>
  import Step from "./Step.svelte";
  import Iteration from "./Iteration.svelte";
  import { fade, fly } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  import Solutions from "./Solutions.svelte";
  import ModalContainer from "./ModalContainer.svelte";
  import CoachNote from "./CoachNote.svelte";
  import { helper } from "../helper.js";
  import { coachStep, covered, nextBehaviour, KATA } from "../coach.js";
  import { fizzbuzzHints, phaseHints } from "../content/fizzbuzzHints.js";

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
    const finished = gameState.state.id;
    gameState.nextStep();
    gameState = gameState;
    coachStep(finished, $helper);
  };

  // Once the coach has seen what the pair covered, the goal follows the
  // teacher's route from there instead of the fixed per-iteration list.
  // Non-red steps are passed through unchanged, so a verdict arriving
  // mid-step doesn't re-key (and re-animate) the step card.
  const withCoachGoal = (step, coveredIds) => {
    if (step?.stateName !== "red" || !coveredIds.length) return step;
    const next = nextBehaviour(KATA, coveredIds);
    return next ? { ...step, goal: next.hint } : step;
  };
  $: baseStep = gameState.getStep();
  $: currentStep = withCoachGoal(baseStep, $covered);

  // The hint is for the behaviour this loop is about: on Red the one the goal
  // points at, on Green and Refactor the one the Red test targeted. The
  // coach's view wins once it has one, otherwise the teacher's route.
  const hintFor = (step, coveredIds) => {
    const phase = step?.stateName;
    if (!phaseHints[phase]) return "";
    const routed = KATA.teacherRoute[step.iteration]?.at(-1);
    let id = routed;
    if (coveredIds.length)
      id = phase === "red" ? nextBehaviour(KATA, coveredIds)?.id : coveredIds.at(-1);
    return fizzbuzzHints[id]?.[phase] || phaseHints[phase];
  };
  $: hint = hintFor(currentStep, $covered);

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
  <CoachNote />
  {#if currentStep}
    <div transition:fade>
      <Step step={currentStep} {hint} on:interact={nextStep} />
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
