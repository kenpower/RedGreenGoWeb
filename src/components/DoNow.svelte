<script>
  // The one thing to do now, at the top of a card: the driver's action, big,
  // and the navigator's job in one short line under it. Everything else on
  // the card supports this line.
  import Icon from "./Icon.svelte";

  export let driver = ""; // the driver's name
  export let driverNumber = 1; // which --player-N colour
  export let action = "";
  export let navigators = []; // names
  export let navigatorNumber = 2;
  export let navigatorAction = "";
  export let held = false; // something to fix first: a red edge
</script>

<div class="doNow" class:held>
  <p class="label">Do this now</p>
  <p class="action" style="--player-col: var(--player-{driverNumber})">
    <Icon icon="keyboard" size="18px" />
    <span class="role"><strong class="name">{driver}</strong> (driver):</span>
    {action}
  </p>
  {#if navigatorAction}
    <p class="navigator" style="--player-col: var(--player-{navigatorNumber})">
      <Icon icon="navigation" size="16px" />
      <span class="role"
        ><strong class="name">{navigators.join(", ")}</strong> (navigator{navigators.length > 1 ? "s" : ""}):</span
      >
      {navigatorAction}
    </p>
  {/if}
  <slot />
</div>

<style>
  .doNow {
    margin: 0.4em 0 0.6em 0;
    padding: 0.3em 0.8em;
    border-left: 3px solid var(--phase-col, var(--text-bright));
    background: var(--opacity-50);
  }

  .doNow.held {
    border-left-color: var(--testing-red);
  }

  .label {
    margin: 0.2em 0;
    font-size: 0.85em;
    color: var(--phase-col, var(--text-bright));
    text-shadow: 0 0 4px var(--phase-col, var(--text-bright));
  }

  .held .label {
    color: var(--testing-red);
    text-shadow: 0 0 4px var(--testing-red);
  }

  .action {
    margin: 0.3em 0;
    font-size: 1.15em;
    color: var(--text-bright);
    overflow-wrap: anywhere;
  }

  .navigator {
    margin: 0.3em 0;
    font-size: 0.9em;
    overflow-wrap: anywhere;
  }

  .name {
    color: var(--player-col);
  }

  .role {
    color: var(--text-muted);
  }

  .doNow :global(img) {
    vertical-align: middle;
  }
</style>
