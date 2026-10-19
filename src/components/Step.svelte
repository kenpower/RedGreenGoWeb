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
    <p class="title">{step.title}</p>

    <div class="stepBody">
      {#if step.stateName == "swap"}
        <div class="handover" style="--player-col: var(--player-{step.driverNumber})">
          <Icon icon="swap" size="40px" />
          <p class="handoverText">Hand the keyboard to {step.driver}</p>
          <p>{step.bodyText}</p>
        </div>
      {:else}
        <div class="driverBanner" style="--player-col: var(--player-{step.driverNumber})">
          <span class="iconChip"><Icon icon="keyboard" /></span>
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
      <div style="background:white; text-align:left">
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
    margin: 0.5em;
    padding: 0.35em;
    border-radius: 5px;
    background-color: var(--player-col);
    color: white;
    font-size: 1.25em;
    font-weight: bold;
  }

  .iconChip {
    display: flex;
    padding: 3px;
    border-radius: 4px;
    background: white;
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
    margin: 0.4em 1em;
    padding: 0.3em 0.6em;
    border-left: 4px solid var(--text-muted);
    background: var(--opacity-50);
    text-align: left;
    font-size: 0.95em;
  }

  .goal {
    font-weight: bold;
    margin-bottom: 0;
  }

  .goalLabel {
    display: block;
    font-size: 0.8em;
    font-weight: normal;
    color: var(--text-muted);
  }

  .handover {
    margin: 0.5em;
    padding: 1em;
    border-radius: 5px;
    background-color: var(--player-col);
    color: white;
  }

  .handover :global(img) {
    background: white;
    border-radius: 6px;
    padding: 4px;
  }

  .handoverText {
    font-size: 1.6em;
    font-weight: bold;
    margin: 0.3em 0;
  }

  .peekRow {
    text-align: right;
    padding: 0 0.5em 0.25em 0;
  }

  .peek {
    background: none;
    border: none;
    padding: 0.2em;
    margin: 0;
    font-size: 0.85em;
    color: var(--text-muted);
    text-decoration: underline;
  }

  span {
    vertical-align: top;
    padding-left: 0.3em;
  }

  .step {
    color: black;
    width: 100%;
    border-radius: 5px;
    border-width: 2px;
    border-style: solid;
    margin-top: 10px;
    min-height: 150px;
  }

  .step p {
    margin: 2;
  }

  .container .step .stepBody {
    padding: 5px;
    display: none;
  }

  .step .title {
    font-weight: bold;
    padding: 4px;
    margin: 0;
  }

  .red .title {
    background-color: var(--testing-red-muted);
  }

  .green .title {
    background-color: var(--coding-green-muted);
  }

  .refactor .title {
    background-color: var(--refactoring-blue-muted);
  }

  .red.step {
    background-color: var(--testing-red-hint);
  }

  .green.step {
    background-color: var(--coding-green-hint);
  }

  .refactor.step {
    background-color: var(--refactoring-blue-hint);
  }

  .red {
    border-color: var(--testing-red);
  }

  .green {
    border-color: var(--coding-green);
  }

  .refactor {
    border-color: var(--refactoring-blue);
  }

  .iteration {
    border-color: black;
    border-radius: 5px;
    border-width: 2px;
    border-style: solid;
    background-color: white;
    padding: 8px;
  }
</style>
