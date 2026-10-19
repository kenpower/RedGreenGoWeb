<script>
  import Solutions from "./Solutions.svelte";
  import ModalContainer from "./ModalContainer.svelte";
  import HintLabel from "./HintLabel.svelte";
  import { fade, fly, blur, scale } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  import Icon from "./Icon.svelte";

  const dispatch = createEventDispatcher();

  export let step;
  // Kept out of `step` so a hint that changes mid-step (when a coach verdict
  // arrives) updates in place instead of re-keying the step and its timer.
  export let hint = "";
  let isOpenModal;
  let solutionHTML = "";
  let dataReady = false;

  let st;

  function peekAtSolution() {
    if (confirm("Try it yourself first!\n\nShow our solution anyway?"))
      isOpenModal = true;
  }

  //TODO move into game
  function scrollIntoView() {
    const el = document.getElementById("theStep");
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
    });
  }

  $: {
    console.log(step);
    if (dataReady)
      solutionHTML = st.getStepText(step.iteration + 1, step.stateName);
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

    <div class="stepBody">
      {#if step.stateName == "swap"}
        <div class="handover" style="--player-col: var(--player-{step.driverNumber})">
          <Icon icon="swap" size="40px" />
          <p class="handoverText">Hand the keyboard to {step.driver}</p>
          <p>{step.bodyText}</p>
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
        {#if step.navigatorPrompt}
          <p class="navigatorPrompt"><strong>Navigator:</strong> {step.navigatorPrompt}</p>
        {/if}
      {/if}
      {#if step.stateName != "swap"}
        <div style="display: flex;justify-content: center;flex-direction: column;">
          {#if step.goal}
            <p class="goal">
              <span class="goalLabel">Iteration {step.iteration + 1} of {step.totalIterations}</span>
              {step.goal}
            </p>
          {/if}
          <p>{step.bodyText}</p>
          <div><HintLabel text={hint} /></div>
        </div>
      {/if}
      <slot name="checks" />
      <div style="display: flex; justify-content:space-evenly; ">
        <button on:click={() => dispatch("interact", "done")}
          >{step.buttonText}</button
        >
      </div>
      {#if solutionHTML?.length != 0}
        <div class="peekRow">
          <button class="peek" on:click={peekAtSolution}
            >Peek at our solution</button
          >
        </div>
      {/if}
    </div>
    <ModalContainer bind:isOpenModal>
      <div class="solution">
        {@html solutionHTML}
      </div>
    </ModalContainer>
  </div>
{/key}

<Solutions bind:this={st} bind:dataReady />

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

  .navigatorPrompt {
    margin: 0.6em 0;
    padding: 0.3em 0.6em;
    border-left: 2px solid var(--text-muted);
    background: var(--opacity-50);
    text-align: left;
  }

  .goal {
    color: var(--text-bright);
    font-weight: 400;
    margin-bottom: 0;
  }

  .goalLabel {
    display: block;
    font-size: 0.9em;
    color: var(--star);
    text-shadow: 0 0 5px var(--star);
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

  .peekRow {
    text-align: right;
  }

  .peek {
    margin: 0;
    font-size: 0.9em;
    color: var(--text-muted);
  }

  .solution {
    text-align: left;
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
