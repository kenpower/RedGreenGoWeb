<script>
  // One tile on the cycle track. Cycles that haven't started yet (phase 0)
  // render nothing, so the track grows as the pair plays.
  import TDDCycle from "./TDDCycle.svelte";
  import { scale } from "svelte/transition";
  import { TDDPhase } from "../gameState";

  export let iterationCounter = 0;
  export let phase = 0;
  // times the coach sent this cycle back to Red
  export let backToRed = 0;

  $: done = phase == TDDPhase.COMPLETED;
</script>

{#if phase > 0}
  <div
    class="iteration"
    class:done
    in:scale
    title={done ? "Cycle " + iterationCounter + " complete" : ""}
  >
    <TDDCycle size={done ? 44 : 80} {phase} text={iterationCounter} />
    {#if !done}
      <p class="title">Cycle {iterationCounter}</p>
    {/if}
    {#if backToRed}
      <p class="backToRed" title="Sent back to Red {backToRed} time{backToRed == 1 ? '' : 's'}">
        ↺ red{backToRed > 1 ? " ×" + backToRed : ""}
      </p>
    {/if}
  </div>
{/if}

<style>
  .iteration {
    border: 1px solid var(--border-strong);
    background-color: var(--bg-panel);
    padding: 6px;
    text-align: center;
  }

  .iteration.done {
    border-color: var(--border);
    padding: 3px;
  }

  .title {
    margin: 0;
    font-size: 0.85em;
    color: var(--text-bright);
  }

  .backToRed {
    margin: 0;
    font-size: 0.75em;
    color: var(--testing-red);
  }
</style>
