<script>
	import Game from "./components/Game.svelte";
	import { fly } from 'svelte/transition';
	export let player1 = "John";
	export let player2 = "Jane";
	
	let gameBegin = false

</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Montserrat:ital,wght@0,300;0,500;1,100;1,300;1,500&family=Roboto+Mono:ital,wght@0,277;0,300;1,300&display=swap" rel="stylesheet">
</svelte:head>

<title>Red Green Go!</title>
<main>
	<h1>Red-Green-Go!</h1>
	<h2>A game of TDD & Pairing</h2>    
	<section>
		{#if gameBegin}
		<div transition:fly="{{ y: 200, duration: 2000 }}">
			<Game  players={[player1,player2]} />
		</div>

		{:else}
		<div >
			<span>
			<label for="fname">Player 1</label>
			<input type="text" id="fname" name="fname" bind:value={player1}><br>
		</span>
		<span>
			<label for="lname">Player 2</label>
			<input type="text" id="lname" name="lname" bind:value={player2}><br>
			</span>	
			<button id="startBtn"  on:click={() => gameBegin = true}>Start Game</button>
			</div>
		{/if}
	</section>
</main>

<style>

	main {
		text-align: center;
		padding: 1em;
		max-width: 500px;
		margin: 0 auto;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
	}

	:global(*){
		--global-game-width: 500px;
		--testing-red: tomato; /* SVG tomato #FF6347 */
		--testing-red-muted: #FFA899; 
		--testing-red-hint: #FFDCD6;
		--coding-green: olivedrab; /* SVG olivedrab #6B8E23	 */
		--coding-green-muted: #A5D24B;
		--coding-green-hint: #cee79d;
		--refactoring-blue: dodgerblue; /*dodgerblue #1E90FF	 */
		--refactoring-blue-muted: #85c2ff;
		--refactoring-blue-hint: #d6ebff;	
	}
	:global(html) {
  	/* THE TRICK to stop scroll bar appearing and moving everything to the left */
  	margin-right: calc(100vw - 100%);
	}


</style>