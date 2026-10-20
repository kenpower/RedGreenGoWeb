<script>
  // Where the pair is in the cycle, as one coloured ASCII line:
  //   [RED] ---> [GREEN] ---> [REFACTOR] --↺  Cycle 1   ([R]-->[G]-->[RF]--↺ 1 on phones)
  // The current phase glows; the rest is dimmed. Each arrow takes the colour
  // of the phase it leaves. On Swap, the R→G arrow carries a highlighted ⇄.
  // Completed cycles collapse into a muted row: ✓1 ✓2 ↺3 (↺ = went back to Red).
  import { TDDPhase } from "../gameState";

  export let iterations = []; // gameState.iterations: [{index, phase, backToRed}]
  export let stateName = ""; // "red" | "swap" | "green" | "refactor", "" when finished
  export let finished = false;

  const NAMES = { red: "Red", swap: "Swap", green: "Green", refactor: "Refactor" };
  const SP = " "; // a space the line keeps, and never wraps at

  $: current = iterations[iterations.length - 1];
  $: cycle = current?.index || 1;
  $: done = iterations.filter((i) => i.phase == TDDPhase.COMPLETED);
  $: phase = finished ? "" : stateName;
  $: label = finished ? `Finished after ${done.length} cycles` : `Cycle ${cycle}, phase ${NAMES[phase] || ""}`;
  const doneTitle = (i) =>
    `Cycle ${i.index} complete` + (i.backToRed ? `, sent back to Red ${i.backToRed} time${i.backToRed == 1 ? "" : "s"}` : "");
</script>

<div class="cycles">
  <!-- wide: [RED] ---> [GREEN] ---> [REFACTOR] --↺  Cycle 1   narrow: [R]-->[G]-->[RF]--↺ 1 -->
  <!-- No whitespace between the spans: the gaps are drawn inside them (as
       no-break spaces), so the narrow form can run together. -->
  <p class="line" role="img" aria-label={label}
    ><span class="ph red" class:on={phase == "red"}><span class="wide">[RED]</span><span class="narrow">[R]</span></span
    ><span class="arrow red" class:on={phase == "swap"}
      >{#if phase == "swap"}<span class="swap" title="Swap driver"
          ><span class="wide">{SP}-⇄->{SP}</span><span class="narrow">-⇄></span></span
        >{:else}<span class="wide">{SP}--->{SP}</span><span class="narrow">--></span>{/if}</span
    ><span class="ph green" class:on={phase == "green"}><span class="wide">[GREEN]</span><span class="narrow">[G]</span></span
    ><span class="arrow green"><span class="wide">{SP}--->{SP}</span><span class="narrow">--></span></span
    ><span class="ph blue" class:on={phase == "refactor"}><span class="wide">[REFACTOR]</span><span class="narrow">[RF]</span></span
    ><span class="arrow blue" title="Back to Red for the next test"><span class="wide">{SP}--↺</span><span class="narrow">--↺</span></span
    ><span class="cycleNo"
      >{#if finished}{SP}{SP}Finished{:else}<span class="wide">{SP}{SP}Cycle {cycle}</span><span class="narrow">{SP}{cycle}</span
        >{/if}</span
    ></p>
  {#if done.length}
    <p class="done" aria-label="{done.length} cycle{done.length == 1 ? '' : 's'} completed">
      {#each done as i}
        <span title={doneTitle(i)}>{i.backToRed ? "↺" : "✓"}{i.index}</span>
      {/each}
    </p>
  {/if}
</div>

<style>
  .cycles {
    margin: 0.2em 0 0.4em 0;
  }

  .line {
    margin: 0;
    white-space: nowrap;
    font-size: 1.05em;
  }

  .line span {
    padding: 0;
  }

  .ph,
  .arrow {
    opacity: 0.45;
  }

  .red {
    color: var(--testing-red);
  }

  .green {
    color: var(--coding-green);
  }

  .blue {
    color: var(--refactoring-blue);
  }

  /* the current phase (or the swap arrow) is bright with its glow */
  .on {
    opacity: 1;
    text-shadow: 0 0 2px currentColor, 0 0 6px currentColor;
    font-weight: 500;
  }

  .swap {
    color: var(--star);
    text-shadow: 0 0 5px var(--star);
  }

  .cycleNo {
    color: var(--text-bright);
  }

  .narrow {
    display: none;
  }

  .done {
    margin: 0.1em 0 0 0;
    font-size: 0.9em;
    color: var(--text-muted);
  }

  .done span {
    margin-right: 0.6em;
    padding: 0;
  }

  /* the full line is ~47 characters (~445px): below that, the short form,
     which fits at 375px, rather than wrapping */
  @media (max-width: 560px) {
    .wide {
      display: none;
    }

    .narrow {
      display: inline;
    }
  }
</style>
