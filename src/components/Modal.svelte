<!-- src/Modal.svelte -->
<script>
  import { createEventDispatcher } from "svelte";
  import { scale } from "svelte/transition";

  export let isOpenModal;
  export let bodyText = "";
  export let titleText = "";
  export let typeText = "";
  export let cardType = "";

  const dispatch = createEventDispatcher();

  function closeModal() {
    isOpenModal = false;
    dispatch("closeModal", { isOpenModal });
  }
</script>

<div
  class="modal-backdrop"
  style="display:
        {isOpenModal ? 'block' : 'none'};"
  on:click={closeModal}
/>

{#if isOpenModal}
  <div transition:scale class="modal-frame card-face {cardType}">
    <div class="modal-content">
      <div class="cardType">{typeText}</div>
      <div class="title">{titleText}</div>
      <div class="bodyText">{@html bodyText}</div>
    </div>
  </div>
{/if}

<style>
  .cardType {
    font-family: "Bangers", cursive;
    font-size: 2.5em;
    /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
    text-shadow: #2e2e2e 0 4px 5px;
  }

  .title {
    font-family: "Montserrat", sans-serif;
    font-size: 3em;
    font-weight: 100;
    font-style: italic;
    /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
  }
  .bodyText {
    font-family: "Montserrat", sans-serif;
    font-size: 1.5em;
    font-weight: 300;

    /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
  }
</style>
