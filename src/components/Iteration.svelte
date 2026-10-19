<script>
  import TDDCycle from "./TDDCycle.svelte";
  export let iterationCounter = 0;
  export let phase = 0;
  let dimmed = false;
  $: dimmed = phase == 0 || phase == 4;
</script>

<div class="iteration" class:dimmed>
  <div class="overlay" />
  <TDDCycle size={100} {phase} text={iterationCounter} />
  <p class="title">
    {dimmed ? "" : "Iteration " + iterationCounter}
  </p>
</div>

<style>
  .iteration {
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    padding: 8px;
    max-width: calc(var(--global-game-width) / 5);
    position: relative;
    text-align: center;
  }

  .title {
    margin: 0;
    font-size: 0.85em;
    color: var(--text-muted);
  }

  .dimmed .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.7;
    background: var(--bg);
  }
</style>
