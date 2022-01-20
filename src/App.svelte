<script>
	import Game from "./components/Game.svelte";
	import IconButton from "./components/IconButton.svelte";
	import {gameState} from './store.js';
	import {reStartGame, startGame} from './gameLogic.js';
	

	import { fly } from 'svelte/transition';
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Montserrat:ital,wght@0,300;0,500;1,100;1,300;1,500&family=Roboto+Mono:ital,wght@0,277;0,300;1,300&display=swap" rel="stylesheet">
</svelte:head>

<title>Red Green Go!</title>
<main>
	<header>
        <div class="menu">
        <IconButton onclick={reStartGame} icon="restart"/>
		</div>
        <div class="title">
			<svg xmlns="http://www.w3.org/2000/svg">
			  <filter id="motion-blur-filter"  filterUnits="userSpaceOnUse">
					  <feGaussianBlur stdDeviation="10 0"></feGaussianBlur>
					  <feOffset dx="5"/>
					  <feMorphology operator="erode" radius="1"/>
			  </filter>
			</svg>
			<span id="red">Red</span>-<span id="green">Green</span>-<span  filter-content="G" class = "swoosh" id="blue">G</span><span id="blue">o!</span>
        </div>
        <div class="menu">
			x
        </div>
    </header>
	
	<h2>A game of TDD & Pairing</h2>    
	<section>
		{#if $gameState.started}
			<div in:fly="{{ y: 200, duration: 2000 }}">
				<Game />
			</div>
		{:else}
		<div >
			<span>
			<label for="fname">Player 1</label>
			<input type="text" id="fname" name="fname" bind:value={$gameState.players[0]}><br>
		</span>
		<span>
			<label for="lname">Player 2</label>
			<input type="text" id="lname" name="lname" bind:value={$gameState.players[1]}><br>
			</span>	
			<button id="startBtn"  on:click={startGame}>Start Game</button>
			</div>
		{/if}
	</section>
</main>

<style>
	header{
		display: flex;
    	justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--color-tone-2);
	}

	.title{
		font-size: 2.5em;
		font-weight: bold;
	}
	h2{
		font-size: 1.5em;
		margin: 0.25em;
		font-weight: 200;
	}
	main {
		text-align: center;
		padding: 1em;
		max-width: 500px;
		margin: 0 auto;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
		color: var(--color-tone-2);
		font-weight: 200;
	}

	label {
        display: inline-block;
        width: 55px;
        text-align: right;
      }

	#red  {color: var(--testing-red);}
	#green{color: var(--coding-green);}
	#blue {
		color: var(--refactoring-blue);
		font-style: italic;
		transform: skew(45deg, 50deg);
	}
	.swoosh::before{
		content: attr(filter-content);
		filter: url(#motion-blur-filter);
	}
	svg {
  		display: none;
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

		--color-tone-1: #1a1a1b;
		--color-tone-2: #787c7e;
		--color-tone-3: #878a8c;
		--color-tone-4: #d3d6da;
		--color-tone-5: #edeff1;
		--color-tone-6: #f6f7f8;
		--color-tone-7: #ffffff;
		--opacity-50: rgba(255, 255, 255, 0.5);
	}
	:global(html) {
  	/* THE TRICK to stop scroll bar appearing and moving everything to the left */
  	margin-left: calc(100vw - 100%);
	}


</style>