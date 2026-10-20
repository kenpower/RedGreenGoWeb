<script>
  import { helper, enableHelper, disableHelper, BLOCKED_HELP } from "../helper.js";
  import { testNames } from "../rules.js";

  let open = false;
  let helperEl;

  // Close on a click outside the badge and panel. composedPath() is fixed
  // when the click starts, so a button that re-renders the panel (Connect,
  // Disconnect) still counts as inside even though it has left the page.
  // The badge is inside too, so its own toggle isn't undone here.
  const closeIfOutside = (event) => {
    if (open && !event.composedPath().includes(helperEl)) open = false;
  };
  const closeOnEscape = (event) => {
    if (open && event.key === "Escape") open = false;
  };

  $: data = $helper.data;
  // The helper remembers every test it has ever seen, so a deleted, renamed or
  // commented-out test keeps its last result. Count only tests still in the
  // source, as the game's start check does; if no names parse (e.g. TYPED_TEST),
  // count them all.
  $: allTests = data?.tests || [];
  $: sourceNames = testNames(data);
  $: inSource = (t) => !sourceNames.size || sourceNames.has(t.name);
  $: tests = allTests.filter(inSource);
  $: removedTests = allTests.filter((t) => !inSource(t));
  $: latestRun = data?.run || 0;
  // which Visual Studio project the helper is watching, e.g. "scratch_test"
  $: project = $helper.status === "connected" ? data?.project : null;
  $: projectName = project?.vsName || project?.name || "";
  $: failed = tests.filter((t) => t.status === "failed").length;
  $: passed = tests.filter((t) => t.status === "passed").length;
  $: buildFailed = data?.build?.status === "failed";
  // {repo: true, branch, headMessage, dirtySource, ...} | {repo: false} | null
  $: git = data?.git;
  // first line, trimmed; the full text is in the tooltip
  const shortError = (error) => {
    const line = String(error).split("\n")[0].trim();
    return line.length > 80 ? line.slice(0, 77) + "…" : line;
  };

  // Words for every state except a connected helper, which shows the build
  // or the test counts instead.
  $: label =
    $helper.status === "off"
      ? "Connect code"
      : $helper.status === "connecting"
      ? "Connecting…"
      : $helper.status === "offline"
      ? "Helper offline"
      : $helper.status === "blocked"
      ? "Browser blocked helper"
      : "";

  $: tooltip =
    $helper.status !== "connected"
      ? "Connection to your code"
      : buildFailed
      ? "Build failed — click for details"
      : tests.length
      ? `${passed} passed, ${failed} failed — click for details`
      : "No test results yet — click for details";

  // Copied next to the bundle by rollup.config.js
  const HELPER_URL = "build/rgg_server.py";

  const icon = (status) => (status === "passed" ? "✔" : status === "failed" ? "✖" : "–");
</script>

<svelte:window on:click={closeIfOutside} on:keydown={closeOnEscape} />

<div class="helper" bind:this={helperEl}>
  <button
    class="badge"
    class:offline={$helper.status === "offline"}
    class:blocked={$helper.status === "blocked"}
    on:click={() => (open = !open)}
    title={tooltip}
  >
    {#if projectName}
      <span class="project" title={project.path || projectName}>{projectName}</span><span class="sep">·</span>
    {/if}
    {#if label}
      {label}
    {:else if buildFailed}
      <span class="fail">Build failed</span>
    {:else if !tests.length}
      <span class="none">No test results yet</span>
    {:else if failed}
      <!-- failing first: it's what the pair has to act on -->
      <span class="fail">{failed} failing</span><span class="sep">·</span><span class="pass">{passed} passing</span>
    {:else}
      <span class="pass">All {passed} passing ✓</span>
    {/if}
  </button>

  {#if open}
    <div class="panel">
      {#if $helper.status === "off"}
        <p>
          Let the game see your tests and code as you work in Visual Studio.
          Save the helper into your solution folder, run
          <code>python rgg_server.py</code> there, then connect.
        </p>
        <a class="download" href={HELPER_URL} download>Download rgg_server.py</a>
        <button on:click={enableHelper}>Connect to my code</button>
      {:else if $helper.status === "blocked"}
        <p class="blockedText"><strong>The browser blocked the helper.</strong></p>
        <p>{BLOCKED_HELP}</p>
        <p class="muted">Retrying automatically…</p>
        <button class="link" on:click={disableHelper}>Stop connecting</button>
      {:else if $helper.status !== "connected"}
        <p><strong>Can't reach the helper.</strong></p>
        <ol>
          <li>
            In your solution folder, run <code>python rgg_server.py</code>
            (<a href={HELPER_URL} download>download it</a> if you don't have it).
          </li>
          <li>
            If the browser asks to access apps on this device, click
            <strong>Allow</strong>.
          </li>
          <li>
            Running it but still not connecting? Chrome may be blocking it: click the
            icon left of the address bar → Site settings → Local network access → Allow, then reload.
          </li>
        </ol>
        <p class="muted">Retrying automatically…</p>
        <button class="link" on:click={disableHelper}>Stop connecting</button>
      {:else}
        {#if buildFailed}
          <p><strong>Build failed</strong></p>
          <ul class="errors">
            {#each data.build.errors as error}
              <li>{error}</li>
            {/each}
          </ul>
        {/if}

        {#if tests.length}
          <ul class="tests">
            {#each tests as test}
              <li
                class={test.status}
                class:stale={test.run < latestRun}
                title={test.run < latestRun ? "From an earlier test run" : ""}
              >
                <span class="icon">{icon(test.status)}</span>{test.name}
                {#if test.message}<pre>{test.message}</pre>{/if}
              </li>
            {/each}
          </ul>
        {:else if !buildFailed}
          <p>Connected. Run your tests in Visual Studio and they'll appear here.</p>
        {/if}

        {#if removedTests.length}
          <p class="muted removedHeading">No longer in your code (not counted)</p>
          <ul class="tests removed">
            {#each removedTests as test}
              <li><span class="icon">{icon(test.status)}</span>{test.name}</li>
            {/each}
          </ul>
        {/if}

        {#if git?.repo}
          <p class="git">
            <span class="branch">{git.branch || "detached HEAD"}</span> ·
            {#if git.dirtySource?.length}
              <span class="dirty">{git.dirtySource.length} uncommitted</span>
            {:else}
              all committed
            {/if}
          </p>
          {#if git.headMessage}
            <p class="muted">Last commit: {git.headMessage}</p>
          {/if}
        {:else if git?.error}
          <p class="muted git" title={git.error}>git unavailable: {shortError(git.error)}</p>
        {:else if git}
          <p class="muted">Not in a git repository</p>
        {/if}

        <p class="muted">
          Watching {data.files.length} source file{data.files.length === 1 ? "" : "s"}
        </p>
        <button class="link" on:click={disableHelper}>Disconnect</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .helper {
    position: relative;
  }

  .badge {
    display: inline-flex;
    align-items: baseline;
    max-width: calc(100vw - 32px);
    margin: 0;
    padding: 0;
    white-space: nowrap;
    cursor: pointer;
  }

  /* the project name gives way first at narrow widths */
  .badge .project {
    min-width: 3em;
    max-width: 14em;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-bright);
  }

  .badge.offline {
    color: var(--text-muted);
  }

  .badge.blocked,
  .blockedText {
    color: var(--testing-red);
    text-shadow: 0 0 5px var(--testing-red);
  }

  /* words, not ✔/✖ glyphs: "1 failing · 0 passing", "All 4 passing ✓" */
  .badge .pass {
    color: var(--coding-green);
    text-shadow: 0 0 4px var(--coding-green);
  }

  .badge .fail {
    color: var(--testing-red);
    text-shadow: 0 0 4px var(--testing-red);
    font-weight: 600;
  }

  .badge .sep {
    margin: 0 0.5em;
    padding: 0;
    color: var(--text-muted);
  }

  .badge .none {
    color: var(--text-muted);
  }

  .panel {
    position: absolute;
    right: 0;
    top: 2.2em;
    z-index: 10;
    width: min(22em, calc(100vw - 32px));
    padding: 0.5em 0.75em;
    text-align: left;
    font-size: 0.9em;
    background: var(--bg-panel);
    border: 1px solid var(--border-strong);
    box-shadow: 0 0 12px #000;
  }

  .panel p {
    margin: 0.4em 0;
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.9em;
  }

  .tests,
  .errors {
    list-style: none;
    padding: 0;
    margin: 0.4em 0;
  }

  .tests li {
    padding: 0.15em 0;
    overflow-wrap: anywhere;
  }

  .tests .icon {
    display: inline-block;
    width: 1.3em;
  }

  .tests .passed .icon {
    color: var(--coding-green);
  }

  .tests .failed .icon {
    color: var(--testing-red);
  }

  .tests .stale {
    opacity: 0.7; /* was 0.55: below AA for the name text */
  }

  .removedHeading {
    margin-bottom: 0;
  }

  /* listed so the counts make sense, but greyed out and without colours */
  .tests.removed li,
  .tests.removed .icon {
    color: var(--text-muted);
    text-decoration: line-through;
  }

  .tests pre,
  .errors li {
    margin: 0.2em 0 0.2em 1.3em;
    font-size: 0.85em;
    white-space: pre-wrap;
    color: var(--text-muted);
  }

  .errors li {
    margin-left: 0;
    color: var(--testing-red);
  }

  .git {
    overflow-wrap: anywhere;
  }

  .branch {
    color: var(--text-bright);
  }

  .dirty {
    color: var(--amber);
  }

  .download {
    display: block;
    margin: 0.4em 0;
  }

  .download::before {
    content: "[";
  }

  .download::after {
    content: "]";
  }

  .link {
    padding: 0;
    margin: 0.2em 0;
    font-size: 0.9em;
    color: var(--text-muted);
  }
</style>
