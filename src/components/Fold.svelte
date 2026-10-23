<script>
  // A secondary part of a card, closed until asked for. The card's top says
  // the one thing to do now; the rest (Why?, Hints, the smell board, More)
  // waits in folds like this, so a beginner can tell what matters.
  export let title = "";
  export let note = ""; // a few words after the title, e.g. "2 of 5 left"
  export let tone = ""; // "amber": a warning worth a look, without opening
  export let open = false;
</script>

<details class="fold tone-{tone}" bind:open>
  <summary><span class="foldTitle">{title}</span>{#if note}<span class="note">{note}</span>{/if}</summary>
  <div class="foldBody"><slot /></div>
</details>

<style>
  .fold {
    margin: 0.3em 0 0 0;
    border-top: 1px solid var(--border);
  }

  summary {
    list-style: none;
    cursor: pointer;
    padding: 0.3em 0;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  /* [+] closed, [-] open, like the page's [bracketed] buttons */
  summary::before {
    content: "[+] ";
    color: var(--link);
  }

  .fold[open] > summary::before {
    content: "[-] ";
  }

  summary:hover .foldTitle,
  summary:focus-visible .foldTitle {
    color: var(--link-hover);
  }

  .note {
    margin-left: 0.6em;
    font-size: 0.85em;
  }

  .tone-amber .foldTitle,
  .tone-amber .note {
    color: var(--amber);
  }

  .foldBody {
    padding: 0 0 0.4em 0.6em;
  }
</style>
