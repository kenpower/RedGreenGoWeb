<script>
  // One line for the game header: what the coach thinks the pair is building.
  // Clicking it reopens OrientCard (on:open). Shows nothing until there is a brief.
  import { createEventDispatcher } from "svelte";
  import WaitingDots from "./WaitingDots.svelte";

  export let brief = null; // the same brief as OrientCard
  export let loading = false;

  const dispatch = createEventDispatcher();
</script>

{#if loading}
  <p class="line muted">The coach is reading your code<WaitingDots label="Reading your code" /></p>
{:else if brief?.building}
  <button class="line" on:click={() => dispatch("open")} title="Open the coach's reading of your code">
    <span class="muted">What the coach thinks you're building:</span>
    <span class="building">{brief.building}</span>
  </button>
{/if}

<style>
  .line {
    display: block;
    width: 100%;
    margin: 0.3em 0 0 0;
    padding: 0;
    text-align: left;
    font-size: 0.9em;
    /* one line, cut with "…" (the whole text is on the card) */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* a line of text that opens the card, not a [bracketed] action */
  button.line::before,
  button.line::after {
    content: none;
  }

  .muted {
    color: var(--text-muted);
  }

  .building {
    color: var(--link);
  }

  button.line:hover .building,
  button.line:focus-visible .building {
    color: var(--link-hover);
  }

  button.line:focus-visible {
    outline: 1px dotted var(--link);
  }
</style>
