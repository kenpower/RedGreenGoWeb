<script>
  // The end of a game, turned into learning: what the record shows (refactor lab,
  // refactorings the coach saw) and one question for the pair to answer in a
  // sentence or two. The TDD counts stay in Game's own finished screen. The answer
  // is kept in gameState and goes to the teacher as a `reflection` event.
  import { createEventDispatcher } from "svelte";
  import { reflectionQuestionFor, MAX_REFLECTION_CHARS } from "../gameState.js";

  export let gameState;
  const dispatch = createEventDispatcher();

  $: lab = gameState.lab;
  $: fixed = (lab?.board || []).filter((s) => s.resolved);
  $: seen = Object.entries(gameState.refactorings || {});
  $: question = gameState.reflection?.question || reflectionQuestionFor(gameState.gameId);

  let draft = "";
  let saved = gameState.reflection; // {question, answer} once sent
  const save = () => {
    gameState.saveReflection(draft);
    saved = gameState.reflection;
    if (saved) dispatch("save");
  };
</script>

<div class="reflection">
  {#if lab}
    <p>
      Refactor lab: {lab.rounds} round{lab.rounds === 1 ? "" : "s"} finished, {lab.commits}
      commit{lab.commits === 1 ? "" : "s"} seen, {lab.reverts} undone after a red run.
    </p>
    {#if fixed.length}
      <p class="head">Smells fixed:</p>
      <ul>
        {#each fixed as smell}
          <li>{smell.what} <span class="muted">({smell.refactoring})</span></li>
        {/each}
      </ul>
    {/if}
  {/if}
  {#if seen.length}
    <p class="head">Refactorings the coach saw:</p>
    <ul>
      {#each seen as [name, count]}
        <li>{name}{count > 1 ? ` ×${count}` : ""}</li>
      {/each}
    </ul>
  {/if}

  <p class="head">One last question</p>
  <p class="question">{question}</p>
  {#if saved}
    <p class="answer">{saved.answer}</p>
    <p class="muted">Saved, and sent to your teacher.</p>
  {:else}
    <label class="sr" for="reflection-answer">Your answer</label>
    <textarea id="reflection-answer" rows="3" maxlength={MAX_REFLECTION_CHARS} bind:value={draft} />
    <div class="actions">
      <button on:click={save} disabled={!draft.trim()}>Save my answer</button>
    </div>
  {/if}
</div>

<style>
  .reflection {
    text-align: left;
  }

  .head {
    margin-bottom: 0;
    color: var(--text-bright);
  }

  .question {
    color: var(--star);
  }

  ul {
    margin-top: 0.2em;
  }

  .muted {
    color: var(--text-muted);
  }

  .answer {
    padding-left: 0.6em;
    border-left: 2px solid var(--star);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  textarea {
    width: 100%;
    resize: vertical;
  }

  .actions {
    display: flex;
    justify-content: center;
  }

  .sr {
    position: absolute;
    left: -9999px;
  }
</style>
