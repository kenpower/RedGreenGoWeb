<script>
  import { slide } from "svelte/transition";
  import { coach, isGood } from "../coach.js";

  const phaseNames = { red: "test", green: "code", refactor: "refactor" };

  $: verdict = $coach.verdict;
  $: tone = $coach.status === "done" ? (isGood(verdict) ? "good" : "warn") : "muted";

  const dismiss = () => coach.update((c) => ({ ...c, show: false }));
</script>

{#if $coach.show && $coach.status !== "idle"}
  <div class="coachNote {tone}" transition:slide>
    <span class="label">Coach · your last {phaseNames[$coach.phase] || "step"}</span>
    {#if $coach.status === "asking"}
      <p class="muted">Looking at your last step…</p>
    {:else if $coach.status === "error"}
      <p class="muted">{$coach.message}</p>
    {:else}
      <p>{verdict.note}</p>
    {/if}
    {#if $coach.status !== "asking"}
      <button class="close" on:click={dismiss} title="Hide">×</button>
    {/if}
  </div>
{/if}

<style>
  .coachNote {
    position: relative;
    margin-top: 1em;
    padding: 0.4em 2em 0.4em 0.8em;
    border-left: 2px solid var(--color-tone-3);
    background: var(--bg-panel);
    text-align: left;
  }

  .coachNote.good {
    border-left-color: var(--coding-green);
  }

  .coachNote.warn {
    border-left-color: var(--testing-red);
  }

  .label {
    font-size: 0.9em;
    color: var(--star);
    text-shadow: 0 0 5px var(--star);
  }

  p {
    margin: 0.2em 0;
  }

  .muted {
    color: var(--text-muted);
  }

  .close {
    position: absolute;
    top: 0.2em;
    right: 0.3em;
    margin: 0;
    padding: 0 0.3em;
    font-size: 0.9em;
    color: var(--text-muted);
    cursor: pointer;
  }
</style>
