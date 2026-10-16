<script>
  import { helper, enableHelper, disableHelper } from "../helper.js";

  let open = false;

  $: data = $helper.data;
  $: tests = data?.tests || [];
  $: latestRun = data?.run || 0;
  $: failed = tests.filter((t) => t.status === "failed").length;
  $: passed = tests.filter((t) => t.status === "passed").length;
  $: buildFailed = data?.build?.status === "failed";

  $: badge =
    $helper.status === "off"
      ? "Connect code"
      : $helper.status === "connecting"
      ? "Connecting…"
      : $helper.status === "offline"
      ? "Helper offline"
      : buildFailed
      ? "Build failed"
      : tests.length
      ? `${passed} ✔ ${failed} ✖`
      : "Connected";

  $: dotClass =
    $helper.status !== "connected"
      ? "grey"
      : buildFailed || failed
      ? "red"
      : tests.length
      ? "green"
      : "grey";

  const icon = (status) => (status === "passed" ? "✔" : status === "failed" ? "✖" : "–");
</script>

<div class="helper">
  <button class="badge" on:click={() => (open = !open)} title="Connection to your code">
    <span class="dot {dotClass}" />{badge}
  </button>

  {#if open}
    <div class="panel">
      {#if $helper.status === "off"}
        <p>
          Let the game see your tests and code as you work in Visual Studio.
          In your solution folder, run <code>python rgg_server.py</code>, then
          connect.
        </p>
        <button on:click={enableHelper}>Connect to my code</button>
      {:else if $helper.status !== "connected"}
        <p><strong>Can't reach the helper.</strong></p>
        <ol>
          <li>In your solution folder, run <code>python rgg_server.py</code>.</li>
          <li>
            If the browser asks to access apps on this device, click
            <strong>Allow</strong>.
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
              <li class={test.status} class:stale={test.run < latestRun}>
                <span class="icon">{icon(test.status)}</span>{test.name}
                {#if test.message}<pre>{test.message}</pre>{/if}
              </li>
            {/each}
          </ul>
        {:else if !buildFailed}
          <p>Connected. Run your tests in Visual Studio and they'll appear here.</p>
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
    display: flex;
    align-items: center;
    gap: 0.4em;
    margin: 0;
    padding: 0.25em 0.6em;
    font-size: 0.85em;
    border-radius: 1em;
    white-space: nowrap;
    cursor: pointer;
  }

  .dot {
    width: 0.7em;
    height: 0.7em;
    border-radius: 50%;
  }

  .dot.grey {
    background: var(--color-tone-3);
  }

  .dot.red {
    background: var(--testing-red);
  }

  .dot.green {
    background: var(--coding-green);
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
    background: var(--color-tone-7);
    border: 1px solid var(--color-tone-4);
    border-radius: 5px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
    opacity: 0.55;
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

  .link {
    background: none;
    border: none;
    padding: 0;
    margin: 0.2em 0;
    font-size: 0.85em;
    color: var(--text-muted);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
