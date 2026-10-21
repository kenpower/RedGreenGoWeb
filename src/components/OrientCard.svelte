<script>
  // The coach's reading of the pair's code at the start of a game (DESIGN-coach-flow.md 3A):
  // what they are building, where the code stands, what to watch out for and the first move.
  // Shown after Start and reopened from OrientLine. Game.svelte owns the brief and the calls:
  //   on:confirm             "That's right": close the card
  //   on:editProblem={text}  the pair's words replace brief.building
  //   on:reread              run Orient again on the code as it is now
  import { createEventDispatcher, tick } from "svelte";
  import WaitingDots from "./WaitingDots.svelte";
  import { codeStateText, warningsOf, problemEdit, rereadNote, MAX_PROBLEM_EDIT } from "../orient.js";

  // {building, code_state: "empty"|"scaffold"|"partial"|"looks_done", warnings: string[], first_move} | null
  export let brief = null;
  export let loading = false;
  export let error = null;

  const dispatch = createEventDispatcher();

  let editing = false;
  let draft = "";
  let textarea;

  $: warnings = warningsOf(brief);
  $: codeText = codeStateText(brief);
  // a new reading (or a new request) closes the problem box
  $: brief, loading, (editing = false);

  // "Read my code again": when the reading comes back, say so, even when it
  // hasn't changed (otherwise the button looks like it did nothing).
  let rereading = false;
  let before = null;
  let wasLoading = loading;
  let note = "";
  $: finishReread(loading);
  function finishReread(now) {
    if (wasLoading && !now && rereading) {
      note = rereadNote(before, brief, error);
      rereading = false;
    }
    wasLoading = now;
  }

  function reread() {
    before = brief;
    rereading = true;
    note = "";
    dispatch("reread");
  }

  async function startEditing() {
    draft = brief?.building || "";
    editing = true;
    await tick();
    textarea?.focus();
  }

  function save() {
    const text = problemEdit(draft);
    if (!text) return;
    editing = false;
    dispatch("editProblem", text);
  }

  function onKeydown(event) {
    if (event.key === "Escape") editing = false;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) save();
  }
</script>

<section class="orient" aria-labelledby="orient-heading" aria-busy={loading}>
  <h2 id="orient-heading" class="aoc-heading">Here's what the coach sees</h2>

  {#if loading}
    <p class="muted" role="status">The coach is reading your code<WaitingDots label="Reading your code" /></p>
  {:else if error}
    <p class="error" role="alert">{error}</p>
  {:else if !brief}
    <p class="muted">The coach hasn't read your code yet.</p>
  {:else if note}
    <p class="note" role="status">{note}</p>
  {/if}

  {#if brief && !loading}
    <dl class="rows">
      <dt>Building:</dt>
      <dd class="building">{brief.building}</dd>

      {#if codeText}
        <dt>Your code:</dt>
        <dd>{codeText}</dd>
      {/if}

      {#if warnings.length}
        <dt class="warn">Watch out:</dt>
        <dd>
          {#if warnings.length === 1}
            {warnings[0]}
          {:else}
            <ul>
              {#each warnings as warning}<li>{warning}</li>{/each}
            </ul>
          {/if}
        </dd>
      {/if}

      {#if brief.first_move}
        <dt>First move:</dt>
        <dd class="first">{brief.first_move}</dd>
      {/if}
    </dl>
  {/if}

  {#if editing}
    <div class="edit">
      <label for="orient-problem">What are you building? In your own words:</label>
      <textarea
        id="orient-problem"
        rows="3"
        maxlength={MAX_PROBLEM_EDIT}
        bind:value={draft}
        bind:this={textarea}
        on:keydown={onKeydown}
      />
      <div class="actions">
        <button on:click={save} disabled={!problemEdit(draft)}>Save</button>
        <button class="quiet" on:click={() => (editing = false)}>Cancel</button>
      </div>
    </div>
  {:else if !loading}
    <!-- no buttons while the coach is reading: the line above says why, rather
         than [bracketed] buttons that look clickable but aren't -->
    <div class="actions">
      {#if brief}
        <button on:click={() => dispatch("confirm")}>That's right</button>
        <button on:click={startEditing}>Not quite: edit the problem</button>
      {/if}
      <button on:click={reread}>Read my code again</button>
    </div>
  {/if}
</section>

<style>
  .orient {
    width: 100%;
    box-sizing: border-box;
    margin-top: 1em;
    padding: 0.8em 1em;
    background: var(--bg-panel);
    border: 1px solid var(--border-strong);
  }

  /* label column beside the text; stacked on a phone */
  .rows {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.4em 1em;
    margin: 0;
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .building,
  .first {
    color: var(--text-bright);
  }

  .warn {
    color: var(--amber);
  }

  ul {
    margin: 0;
    padding-left: 1.2em;
  }

  .error {
    color: var(--testing-red);
  }

  .note {
    color: var(--coding-green);
  }

  .muted {
    color: var(--text-muted);
  }

  .edit {
    margin-top: 0.8em;
  }

  .edit label {
    margin-bottom: 0.3em;
  }

  textarea {
    width: 100%;
    resize: vertical;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-evenly;
    gap: 0.5em;
    margin-top: 0.8em;
  }

  .actions button {
    margin: 0;
  }

  .quiet {
    color: var(--text-muted);
  }

  @media (max-width: 480px) {
    .rows {
      grid-template-columns: 1fr;
      gap: 0.1em;
    }

    dd {
      margin-bottom: 0.5em;
    }

    .actions {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
