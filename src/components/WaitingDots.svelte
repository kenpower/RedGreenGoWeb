<script>
  // Three dots that grow and fade in turn, sized and coloured to sit inline
  // in whatever text they follow.
  export let label = "Waiting";
</script>

<span class="dots" role="status" aria-label={label}>
  <span class="dot" /><span class="dot" /><span class="dot" />
</span>

<style>
  .dots {
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
    height: 1em;
    margin-left: 0.15em;
    vertical-align: middle;
  }

  .dot {
    width: 0.25em;
    height: 0.25em;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 1.2s ease-in-out infinite;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0%,
    80%,
    100% {
      transform: scale(0.6);
      opacity: 0.3;
    }
    40% {
      transform: scale(1.3);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dots {
      gap: 0.15em;
    }

    .dot {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
