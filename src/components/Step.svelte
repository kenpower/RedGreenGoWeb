<script>
import HintCard from "./HintCard.svelte";
import {
    tick
} from 'svelte';

export let step;
let showHint = false;

async function showCard() {
    showHint = true;
    await tick()
    showHint = false
}

function scrollIntoView() {
    const el = document.getElementById("theStep");
    if (!el) return;
    el.scrollIntoView({
        behavior: 'smooth'
    });
}

$: {
    scrollIntoView();
}
</script>

<div class = {step.classes} id = "theStep">
    <p class = "title">{step.title}</p>

    <div class ="stepBody">
        <p>{step.bodyText}</p>
        <button on:click={step.buttonAction}>{step.buttonText}</button>
        <button on:click={showCard}>Hint</button>
    </div>
    <HintCard {showHint} cardType = {step.helpName} />
        </div>

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
