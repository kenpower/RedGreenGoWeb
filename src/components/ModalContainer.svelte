<script>
  import { createEventDispatcher } from "svelte";
  import { fly, fade, scale } from "svelte/transition";

  export let isOpenModal = false;

  const dispatch = createEventDispatcher();

  function closeModal() {
    isOpenModal = false;
    dispatch("closeModal", { isOpenModal });
  }
</script>

<div
  id="background"
  style="display: 
        {isOpenModal ? 'block' : 'none'};"
  on:click={closeModal}
/>

{#if isOpenModal}
  <div transition:scale id="frame">
    <div class="modal">
      <slot />
    </div>
  </div>
{/if}

<style>
  #background {
    position: fixed;
    z-index: 1;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #0008;
  }
  #frame {
    border-radius: 20px;
    position: fixed;
    z-index: 2;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 450px;
    min-height: 75vh;
    height: 75vh;
  }
  .modal {
    margin: 10px;
    overflow-y: auto;
  }
</style>
