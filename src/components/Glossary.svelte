<script>
  // A refactoring (or smell) name that opens its glossary entry on tap
  // (content/glossary.js). An unknown name is plain text.
  import { glossaryFor } from "../content/glossary.js";

  export let name = "";
  let open = false;
  $: entry = glossaryFor(name);
</script>

{#if entry}
  <button class="quiet term" aria-expanded={open} title="What is this?" on:click={() => (open = !open)}>{name}</button>
  {#if open}
    <span class="entry">
      {entry.line}
      <span class="code before"><span class="tag">before</span>{entry.before}</span>
      <span class="code after"><span class="tag">after</span>{entry.after}</span>
    </span>
  {/if}
{:else}{name}{/if}

<style>
  .term {
    margin: 0;
    padding: 0;
    color: var(--refactoring-blue);
    text-decoration: underline dotted;
  }

  /* no [ ] around a name in running text */
  .term::before,
  .term::after {
    content: "";
  }

  .entry {
    display: block;
    margin: 0.2em 0;
    padding-left: 0.6em;
    border-left: 2px solid var(--refactoring-blue);
    font-size: 0.9em;
    color: var(--text-color);
    text-decoration: none;
    font-style: normal;
    font-weight: 400;
    white-space: normal;
  }

  .code {
    display: block;
    margin: 0.2em 0 0 0;
    padding: 0.1em 0.4em;
    background: var(--bg);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: monospace;
  }

  .tag {
    display: inline-block;
    min-width: 3.8em;
    color: var(--text-muted);
    font-family: inherit;
  }
</style>
