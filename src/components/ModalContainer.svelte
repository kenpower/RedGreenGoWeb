<script>
  import { createEventDispatcher } from "svelte";
  import { scale } from "svelte/transition";

  export let isOpenModal = false;

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
  <div transition:scale class="modal-frame">
    <button class="close" on:click={closeModal}>Close</button>
    <div class="modal-content">
      <slot />
    </div>
  </div>
{/if}

<style>
  .close {
    float: right;
    margin: 4px 6px 0 0;
    padding: 0;
  }
</style>
