<script>
	export let phase;
	export let text = 1
	export let size = 100;
	let hsize=size/2;
	let radius = hsize*0.65;
	let textScale = size/50.0;
	const phase1Col="tomato"
	const phase2Col ="olivedrab"
	const phase3Col ="dodgerblue"
	let phase1FillCol = phase1Col
	let phase2FillCol = phase2Col
	let phase3FillCol = phase3Col
	$:{
		phase1FillCol = phase < 2 ?  "white" :phase1Col
		phase2FillCol = phase < 3 ?  "white" :phase2Col
		phase3FillCol = phase < 4 ?  "white" :phase3Col
	}
</script>

<svg height="{size}" width="{size}">
	  <defs>
    <marker id="arrowheadred" markerWidth="1.5" markerHeight="2" 
    refX="0.5" refY="1" orient="auto">
      <polygon points="0 0, 1.5 1, 0 2"   fill="tomato" />
    </marker>
			    <marker id="arrowheadgreen" markerWidth="1.5" markerHeight="2" 
    refX="0.5" refY="1" orient="auto">
      <polygon points="0 0, 1.5 1, 0 2" fill="olivedrab" />
    </marker>
			    <marker id="arrowheadblue" markerWidth="1.5" markerHeight="2" 
    refX="0.5" refY="1" orient="auto">
      <polygon points="0 0, 1.5 1, 0 2" fill="dodgerblue" />
    </marker>
  </defs>

  <g> 
	  {#if phase > 0}
		<text x="0" y="0" transform="translate({hsize} {hsize*1.25}) scale({textScale},{textScale})" style="text-anchor: middle">{text}</text>
	  {/if}	
		<path id="arrow"
			d="M 0 -0.75
						l 0 -0.5
				A 1.25 1.25, 0, 0, 0, -1.2 -0.21
						l -0.25 0, 0.45 0.7 0.45 -0.7 -0.2 0
						A 0.75 0.75, 0, 0, 1, 0 -0.75
						"	 
			stroke-width="0.02"/>

		<g  transform="
			translate({hsize} {hsize})
            scale({radius} {-radius})">
			<g>
			<use href="#arrow" 
				fill="{phase1FillCol}"
				stroke="{phase1Col}">
				{#if phase == 1}
					<animate attributeName="fill" values="white;{phase1Col};white" dur="3s" repeatCount="indefinite" /> 
				{/if}
			</use>
		
			<use href="#arrow" 
				 fill={phase2FillCol}
				 stroke={phase2Col} 
				 transform="rotate(-120)">
			{#if phase == 2}
			<animate attributeName="fill" values="white;{phase2Col};white" dur="3s" repeatCount="indefinite" />
			{/if}
			</use>
		
		
			<use href="#arrow"  stroke={phase3Col} fill ={phase3FillCol} transform="rotate(120)" >
			{#if phase == 3}
			<animate attributeName="fill" values="white;{phase3Col};white" dur="3s" repeatCount="indefinite" />
			{/if}
			</use>

			{#if phase == 4}
				<animateTransform attributeName="transform"
					attributeType="XML"
					type="rotate"
					from="360 0 0"
					to="0 0 0"
					dur="0.6s"
					repeatCount="3"/>
			{/if}
		
			</g>
		</g>
  </g>
</svg>

