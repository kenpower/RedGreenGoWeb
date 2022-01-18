<script>
	import Game from "./components/Game.svelte";
	//export let name;

</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Montserrat:ital,wght@0,300;0,500;1,100;1,300;1,500&family=Roboto+Mono:ital,wght@0,277;0,300;1,300&display=swap" rel="stylesheet">
</svelte:head>

<title>Red Green Go!</title>
<main>
	<Game/>
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>