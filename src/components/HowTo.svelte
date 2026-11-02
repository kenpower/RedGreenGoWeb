<script>
  // A "[How?]" toggle that opens a short answer inline, for the pair's IDE (content/howto.js).
  // Pass the item ({id?, howto?}); nothing shows when the item has no how-to.
  import { howtoFor } from "../content/howto.js";
  import { ide } from "../helper.js";

  export let item = null;
  let open = false;
  $: howto = howtoFor(item, $ide);
</script>

{#if howto}
  <button class="quiet how" aria-expanded={open} on:click={() => (open = !open)}>{open ? "Hide" : "How?"}</button>
  {#if open}<span class="howText"><strong>{howto.title}:</strong> {howto.steps}</span>{/if}
{/if}

<style>
  .how {
    margin: 0;
    padding: 0 0.2em;
    color: var(--text-muted);
    font-size: 0.9em;
  }

  .howText {
    display: block;
    margin: 0.2em 0 0.2em 0.4em;
    padding-left: 0.6em;
    border-left: 2px solid var(--refactoring-blue);
    font-size: 0.9em;
    color: var(--text-color);
  }
</style>
