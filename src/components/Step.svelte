<script>
import HintCard from "./HintCard.svelte";
import {fade,fly, blur, scale} from "svelte/transition";
import { tick } from 'svelte';
import { createEventDispatcher } from 'svelte';

const dispatch = createEventDispatcher();

export let step;
let showHint = false;

async function showCard() {
    showHint = true;
    await tick()
    showHint = false
}

//TODO move into game
function scrollIntoView() {
    const el = document.getElementById("theStep");
    if (!el) return;
    el.scrollIntoView({
        behavior: 'smooth'
    });
}

$: {
    scrollIntoView(); //no state here, so does it ever get called?
}
</script>

{#key step}
<div  out:fade in:fly="{{ delay: 300, y: 400, duration: 1000 }}" class = {step.classes} id = "theStep">
    <p class = "title">{step.title}</p>
    <div class ="stepBody">
        <p>{step.bodyText}</p>
        <button on:click="{() => dispatch('interact', 'done')}">{step.buttonText}</button>
        <button on:click={showCard}>Hint</button>
    </div>
    <!-- TODO move into game -->
    <HintCard {showHint} cardType = {step.helpName} />
</div>
{/key}

<style>
.step {
    color: black;
    width: 100%;
    border-radius: 5px;
    border-width: 2px;
    border-style: solid;
    margin-top: 10px;
    min-height: 150px;
}

.step p {
    margin: 2;
}

button {
    position: relative;
    bottom: 0px;
}

.container .step .stepBody {
    padding: 5px;
    display: none;
}

.step .title {
    font-weight: bold;
    padding: 4px;
    margin: 0;
}

.red .title {
    background-color: var(--testing-red-muted);
}

.green .title {
    background-color:var(--coding-green-muted);
}

.refactor .title {
    background-color: var(--refactoring-blue-muted);
}

.red.step {
    background-color: var(--testing-red-hint);
}

.green.step {
    background-color:var(--coding-green-hint);
}

.refactor.step {
    background-color: var(--refactoring-blue-hint);
}

.red {
    border-color: var(--testing-red);
}

.green {
    border-color: var(--coding-green);
}

.refactor {
    border-color:var(--refactoring-blue);
}

.iteration {
    border-color: black;
    border-radius: 5px;
    border-width: 2px;
    border-style: solid;
    background-color: white;
    padding: 8px;
}
</style>
