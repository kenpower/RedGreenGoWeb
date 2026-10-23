<script>
  // "In a mess?": a folded guide back to code that works (mess.js). Stands out
  // while the build or a test is failing, when it's most likely needed.
  import { messGuide } from "../mess.js";

  export let mode = "tdd";
  export let phase = "red";
  export let uncommitted = [];
  export let failing = false;

  let open = false;
  $: guide = messGuide(mode, phase, uncommitted);
</script>

<div class="mess" class:failing>
  <button class="toggle" aria-expanded={open} on:click={() => (open = !open)}
    >{open ? "▾" : "▸"} In a mess? Get back to code that works</button
  >
  {#if open}
    <p class="title">{guide.title}</p>
    <ol>
      {#each guide.steps as text}<li>{text}</li>{/each}
    </ol>
    {#if guide.files.length}
      <p class="muted">Changed: {guide.files.map((f) => f.split("/").pop()).join(", ")}</p>
    {/if}
  {/if}
</div>

<style>
  .mess {
    margin: 0.6em 0 0 0;
    font-size: 0.9em;
  }

  .toggle {
    margin: 0;
    color: var(--text-muted);
  }

  .failing .toggle {
    color: var(--amber);
  }

  .title {
    margin: 0.4em 0 0.2em 0;
    color: var(--text-bright);
  }

  ol {
    margin: 0.2em 0;
    padding-left: 1.6em;
    overflow-wrap: anywhere;
  }

  li {
    margin: 0.2em 0;
  }

  .muted {
    margin: 0.2em 0;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
</style>
