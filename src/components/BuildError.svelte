<script>
  // A failed build, in plain words: the first error's file and line, what it
  // usually means (content/buildErrors.js, no coach needed), and the coach's
  // sentence about this code when it has one. Beginners can't read MSVC
  // errors, and fixing the first one often fixes the rest.
  import { firstBuildError, errorPlace } from "../content/buildErrors.js";

  export let errors = []; // the helper's build.errors lines
  export let heading = "The code doesn't build";
  export let coachHelp = ""; // the coach's build_help for this build, or ""

  $: first = firstBuildError(errors);
  $: place = errorPlace(first);
</script>

{#if errors.length}
  <div class="buildError">
    <p class="marker">{heading}{place ? `: ${place}` : ""}</p>
    {#if first}
      <p class="compiler"><span class="errorCode">{first.code}</span> {first.message}</p>
      {#if first.help}<p>{first.help}</p>{/if}
    {:else}
      <p class="compiler">{errors[0]}</p>
    {/if}
    {#if coachHelp}<p class="coachHelp"><span class="who">Coach:</span> {coachHelp}</p>{/if}
    {#if errors.length > 1}
      <details>
        <summary>Fix this one first: the other {errors.length - 1} often go away with it</summary>
        <ul>
          {#each errors.slice(1, 10) as line}<li>{line}</li>{/each}
        </ul>
      </details>
    {/if}
  </div>
{/if}

<style>
  .buildError {
    margin: 0 0 0.6em 0;
    padding: 0.3em 0.8em;
    border: 1px solid var(--testing-red);
    background: var(--bg-panel);
    overflow-wrap: anywhere;
  }

  .buildError p {
    margin: 0.3em 0;
  }

  .marker {
    color: var(--testing-red);
    text-shadow: 0 0 5px var(--testing-red);
    font-weight: 500;
  }

  /* the compiler's own words, quieter than the plain sentence under them */
  .compiler {
    font-size: 0.85em;
    color: var(--text-muted);
  }

  .errorCode {
    color: var(--text-bright);
  }

  .coachHelp {
    padding-left: 0.6em;
    border-left: 2px solid var(--refactoring-blue);
  }

  .who {
    color: var(--refactoring-blue);
  }

  summary {
    cursor: pointer;
    font-size: 0.85em;
    color: var(--text-muted);
  }

  ul {
    margin: 0.3em 0;
    padding-left: 1.5em;
    font-size: 0.85em;
  }
</style>
