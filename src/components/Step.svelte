<script>
  import HintCard from "./HintCard.svelte";
  import Solutions from "./Solutions.svelte";
  import ModalContainer from "./ModalContainer.svelte";
  import Card from "./Card.svelte";
  import { fade, fly, blur, scale } from "svelte/transition";
  import { tick } from "svelte";
  import { createEventDispatcher } from "svelte";
  import Icon from "./Icon.svelte";
  import TimedButton from "./TimedButton.svelte";

  const dispatch = createEventDispatcher();

  export let step;
  let isOpenModal;
  let solutionHTML = "";
  let dataReady = false;

  let st;

  let showHint = false;

  async function showCard() {
    showHint = true;
    await tick();
    showHint = false;
  }

  async function showSolution() {
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
      <div style="display: flex;justify-content: center;">
        {#if step.helpName !== ""}
        <div class="cardDeck" on:click={showCard}>
            <Card off={12} cardType={step.helpName} {showHint} />
            <Card off={8} cardType={step.helpName} />
            <Card off={4} cardType={step.helpName} />
            <Card off={0} cardType={step.helpName} />
        </div>
        {/if}
        <div style="display: flex;justify-content: center;flex-direction: column;">
          <p>{step.bodyText}</p>
          <div>
            <div>
              <Icon icon="keyboard" />
              <span> {step.driver} is the driver</span>
            </div>
            {#each step.navigators as navigator}
            <div>
              <Icon icon="navigation" />
                <span>{navigator} is the navigator</span>
            </div>
            {/each}
          </div>
        </div>
        
      </div>
      <div style="display: flex; justify-content:space-evenly; ">
        <button on:click={() => dispatch("interact", "done")}
          >{step.buttonText}</button
        >
         {#if solutionHTML?.length != 0}
          <TimedButton on:solution={showSolution} text="Solution" />
        {/if}
      </div>
    </div>
    <!-- TODO move into game, or should I??? -->
    <!-- TODO make hint a sub component of modalContainer -->
    <!-- <HintCard {showHint} cardType={step.helpName} /> -->
    <ModalContainer bind:isOpenModal>
      <div style="background:white">
        {@html solutionHTML}
      </div>
    </ModalContainer>
  </div>
{/key}

<Solutions bind:this={st} bind:dataReady />

<style>
  .cardDeck {
    position: relative; /*absolute children position relative to this, not body*/
    min-width: calc(var(--app-width) * 0.3);
    min-height: calc(var(--app-width) * 0.45);
    margin: 0.5em;
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
