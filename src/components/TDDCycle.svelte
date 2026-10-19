<script>
  export let phase;
  export let text = 1;
  export let size = 100;
  let hsize = size / 2;
  let radius = hsize * 0.65;
  let textScale = size / 50.0;
  const phase1Col = "#ff6347";
  const phase2Col = "#00cc00";
  const phase3Col = "#3f9cff";
  let phase1FillCol = phase1Col;
  let phase2FillCol = phase2Col;
  let phase3FillCol = phase3Col;
  // unfilled arrows match the dark iteration tile behind them
  const emptyCol = "#10101a";
  $: {
    phase1FillCol = phase < 2 ? emptyCol : phase1Col;
    phase2FillCol = phase < 3 ? emptyCol : phase2Col;
    phase3FillCol = phase < 4 ? emptyCol : phase3Col;
  }
</script>

<svg height={size} width={size}>
  <defs>
    <marker
      id="arrowheadred"
      markerWidth="1.5"
      markerHeight="2"
      refX="0.5"
      refY="1"
      orient="auto"
    >
      <polygon points="0 0, 1.5 1, 0 2" fill={phase1Col} />
    </marker>
    <marker
      id="arrowheadgreen"
      markerWidth="1.5"
      markerHeight="2"
      refX="0.5"
      refY="1"
      orient="auto"
    >
      <polygon points="0 0, 1.5 1, 0 2" fill={phase2Col} />
    </marker>
    <marker
      id="arrowheadblue"
      markerWidth="1.5"
      markerHeight="2"
      refX="0.5"
      refY="1"
      orient="auto"
    >
      <polygon points="0 0, 1.5 1, 0 2" fill={phase3Col} />
    </marker>
  </defs>

  <g>
    {#if phase > 0}
      <text
        x="0"
        y="0"
        transform="translate({hsize} {hsize *
          1.25}) scale({textScale},{textScale})"
        fill="#ffffff"
        style="text-anchor: middle">{text}</text
      >
    {/if}
    <path
      id="arrow"
      d="M 0 -0.75
						l 0 -0.5
				A 1.25 1.25, 0, 0, 0, -1.2 -0.21
						l -0.25 0, 0.45 0.7 0.45 -0.7 -0.2 0
						A 0.75 0.75, 0, 0, 1, 0 -0.75
						"
      stroke-width="0.02"
    />

    <g
      transform="
			translate({hsize} {hsize})
            scale({radius} {-radius})"
    >
      <g>
        <use href="#arrow" fill={phase1FillCol} stroke={phase1Col}>
          {#if phase == 1}
            <animate
              attributeName="fill"
              values="{emptyCol};{phase1Col};{emptyCol}"
              dur="3s"
              repeatCount="indefinite"
            />
          {/if}
        </use>

        <use
          href="#arrow"
          fill={phase2FillCol}
          stroke={phase2Col}
          transform="rotate(-120)"
        >
          {#if phase == 2}
            <animate
              attributeName="fill"
              values="{emptyCol};{phase2Col};{emptyCol}"
              dur="3s"
              repeatCount="indefinite"
            />
          {/if}
        </use>

        <use
          href="#arrow"
          stroke={phase3Col}
          fill={phase3FillCol}
          transform="rotate(120)"
        >
          {#if phase == 3}
            <animate
              attributeName="fill"
              values="{emptyCol};{phase3Col};{emptyCol}"
              dur="3s"
              repeatCount="indefinite"
            />
          {/if}
        </use>

        {#if phase == 4}
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="360 0 0"
            to="0 0 0"
            dur="0.6s"
            repeatCount="3"
          />
        {/if}
      </g>
    </g>
  </g>
</svg>
