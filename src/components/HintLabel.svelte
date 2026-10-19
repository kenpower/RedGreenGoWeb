<script>
  // A "Hint" label that fills with a progress bar over FILL_SECONDS and
  // unlocks at UNLOCK_SECONDS, so the pair tries the step on their own first.
  // The hint shows as a tooltip on hover or focus, or on click for touch screens.
  // The parent's {#key step} remounts this per step, which restarts the timer.
  import { onMount } from "svelte";

  export let text = "";

  const FILL_SECONDS = 60;
  const UNLOCK_SECONDS = 30;

  let elapsed = 0;
  let open = false;
  $: enabled = elapsed >= UNLOCK_SECONDS;
  $: progress = Math.min(elapsed / FILL_SECONDS, 1) * 100;

  onMount(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      elapsed = (Date.now() - started) / 1000;
      if (elapsed >= FILL_SECONDS) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  });
</script>

{#if text}
  <span class="hintWrap">
    <button
      class="hintLabel"
      class:enabled
      aria-disabled={!enabled}
      aria-expanded={enabled && open}
      title={enabled ? "" : "The hint unlocks after " + UNLOCK_SECONDS + " seconds"}
      style="--progress: {progress}%"
      on:click={() => enabled && (open = !open)}
      on:blur={() => (open = false)}
    >
      Hint
    </button>
    {#if enabled}
      <span class="tooltip" class:open role="tooltip">{text}</span>
    {/if}
  </span>
{/if}

<style>
  .hintWrap {
    position: relative;
    display: inline-block;
  }

  .hintLabel {
    margin: 0.3em;
    padding: 0.2em 0.4em;
    border: none;
    color: var(--text-muted);
    background: linear-gradient(
      to right,
      var(--border) var(--progress),
      transparent var(--progress)
    );
    cursor: not-allowed;
    transition: color 0.3s, border-color 0.3s;
  }

  /* beats the global button hover colour while locked */
  .hintLabel:not(.enabled):hover {
    color: var(--text-muted);
  }

  .hintLabel.enabled {
    color: var(--link);
    cursor: help;
  }

  .hintLabel.enabled:hover,
  .hintLabel.enabled:focus-visible {
    color: var(--link-hover);
  }

  .tooltip {
    display: none;
    position: absolute;
    z-index: 2;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: min(18em, 80vw);
    padding: 0.5em 0.7em;
    border: 1px solid var(--border-strong);
    background: var(--bg-panel);
    color: var(--text-color);
    font-size: 0.9em;
    text-align: left;
    box-shadow: 0 0 12px #000;
  }

  .tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -6px;
    border: 6px solid transparent;
    border-top-color: var(--border-strong);
  }

  .hintWrap:hover .tooltip,
  .hintLabel:focus-visible + .tooltip,
  .tooltip.open {
    display: block;
  }
</style>
