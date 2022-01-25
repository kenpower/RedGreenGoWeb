<script>
	import { onMount } from "svelte";
	let htmlDoc;
	export let dataReady = false;

	origin = window.location.origin
	if(!origin || origin == 'null')
		origin="http://localhost:8080"
	let endpoint = origin + '/content/fizzbuzz.html'
	
	export function getStepText(iteration, step){
		if(!dataReady) {
			return "";
		}
		console.log(iteration, " ",step)

		const selector = "article#loop"+iteration+" section."+step;
		const section = htmlDoc.querySelector(selector);
		console.log(section)
		return section ? section.innerHTML: "";		
	};

	onMount(async function () {
		const response = await fetch(endpoint);
  	let raw = await response.text();
		var parser = new DOMParser();
		htmlDoc = parser.parseFromString(raw, 'text/html');
		dataReady = true
	});
</script>