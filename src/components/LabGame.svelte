<script>
  // The refactor lab (DESIGN-refactor-lab.md B): [REFACTOR] ---> [TEST] ---> [COMMIT] --↺
  // One refactoring per round, the tests never change, roles swap after every
  // commit. The app's own rules (lab.js) gate each Done, so it works without
  // the coach; the coach's smell board and reviews come later (build item 4).
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { helper, refreshHelper } from "../helper.js";
  import { snapshotOf, buildFailed, staleResults, failingTests, currentTests } from "../rules.js";
  import { sendProgress } from "../coach.js";
  import { labStatus, LAB_CARDS, LAB_PHASES } from "../lab.js";
  import { lockReason } from "../lock.js";
  import WaitingDots from "./WaitingDots.svelte";

  export let gameState;

  let tickN = 0; // bumped after each gameState change (it mutates in place)
  $: lab = (tickN, gameState.lab);
  $: phase = lab?.phase || "refactor";
  $: card = LAB_CARDS[phase];
  $: snapshot = $helper.status === "connected" ? snapshotOf($helper.data) : null;
  $: status = snapshot && lab ? labStatus(phase, lab.base, snapshot) : null;
  $: helperMissing = $helper.status !== "connected";
  $: locked = helperMissing || !status?.goalMet;
  $: reason = lockReason({ helperMissing, liveLines: status?.lines || [] });
  $: driver = gameState.players[gameState.driver];
  $: navigators = gameState.players.filter((p, i) => p && i !== gameState.driver);

  // a broken change, then a fixed one, is a revert for the teacher
  $: if (snapshot && lab && !staleResults(snapshot)) {
    const red = buildFailed(snapshot) || failingTests(snapshot).length > 0;
    const green = !red && currentTests(snapshot).length > 0;
    gameState.labRun({ red, green });
  }

  let waiting = false;
  const report = async () => {
    const progress = gameState.progress();
    if ((await sendProgress(progress)) && progress.events.length) gameState.ackEvents(progress.events.length);
  };

  const done = async () => {
    if (waiting || helperMissing) return;
    waiting = true;
    if (await refreshHelper()) await tick(); // the code as it is on disk now
    waiting = false;
    if (!status?.goalMet) return;
    gameState.labDone(snapshot);
    tickN++;
    report();
  };

  const finish = () => {
    if (!confirm("Finish the lab? This ends the game.")) return;
    gameState.finish();
    tickN++;
    report();
  };
</script>

<div class="labLine" role="img" aria-label="Round {lab?.round || 1}, {card?.title}">
  {#each LAB_PHASES as p, i}
    <span class="ph" class:on={!gameState.finished && p === phase}>[{LAB_CARDS[p].title.toUpperCase()}]</span
    >{#if i < LAB_PHASES.length - 1}<span class="arrow"> ---> </span>{:else}<span class="arrow" title="Swap roles, next round"> --↺</span>{/if}
  {/each}
  <span class="round">{gameState.finished ? "  Finished" : `  Round ${lab?.round || 1}`}</span>
</div>

{#if gameState.finished}
  <div class="labCard" transition:fade>
    <p class="title aoc-heading">Lab finished</p>
    <p>{lab?.rounds || 0} refactoring{lab?.rounds === 1 ? "" : "s"} committed{lab?.reverts ? `, ${lab.reverts} undone after a red run` : ""}.</p>
  </div>
{:else if lab}
  <div class="labCard phase-{phase}" transition:fade>
    <p class="title aoc-heading">Round {lab.round}: {card.title}</p>
    <dl class="roles">
      <dt>Driver ({driver})</dt>
      <dd>{card.driver}</dd>
      <dt>Navigator{navigators.length > 1 ? "s" : ""} ({navigators.join(", ")})</dt>
      <dd>{card.navigator}</dd>
    </dl>

    {#if phase === "refactor" && lab.refactorings?.length}
      <p class="muted">Refactorings for this lab: {lab.refactorings.join(", ")}</p>
    {/if}

    {#if status?.lines.length}
      <ul class="live">
        {#each status.lines as line}
          <li class="ok-{line.ok}">{line.text}</li>
        {/each}
      </ul>
    {/if}

    {#if locked && !waiting}
      <p class="doneHint locked">Not yet: {reason}</p>
    {/if}
    <div class="actions">
      {#if waiting}
        <button disabled>Checking<WaitingDots /></button>
      {:else}
        <button class:lockedDone={locked} aria-disabled={locked} on:click={done}>{card.done}</button>
      {/if}
    </div>
    <p class="finishRow"><button class="quiet" on:click={finish}>Finish the lab</button></p>
  </div>
{/if}

<style>
  .labLine {
    margin: 0.2em 0 0.6em 0;
    white-space: nowrap;
    overflow-x: auto;
    color: var(--refactoring-blue);
  }

  .ph,
  .arrow {
    opacity: 0.45;
    padding: 0;
  }

  .on {
    opacity: 1;
    text-shadow: 0 0 2px currentColor, 0 0 6px currentColor;
    font-weight: 500;
  }

  .round {
    color: var(--text-bright);
  }

  .labCard {
    padding: 0.6em 1em;
    border: 1px solid var(--refactoring-blue);
    background: var(--bg-panel);
  }

  .roles {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.3em 1em;
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
  }

  .live {
    list-style: none;
    padding-left: 0;
  }

  .live .ok-true {
    color: var(--coding-green);
  }

  .live .ok-false {
    color: var(--testing-red);
  }

  .live .ok-null {
    color: var(--text-muted);
  }

  .doneHint {
    margin: 0.6em 0 0 0;
    text-align: center;
    font-size: 0.9em;
  }

  .doneHint.locked {
    color: var(--testing-red);
  }

  .actions {
    display: flex;
    justify-content: center;
    margin-top: 0.4em;
  }

  .lockedDone {
    opacity: 0.55;
  }

  .muted,
  .quiet {
    color: var(--text-muted);
  }

  .finishRow {
    margin: 0.6em 0 0 0;
    text-align: right;
  }

  @media (max-width: 480px) {
    .roles {
      grid-template-columns: 1fr;
    }
  }
</style>
