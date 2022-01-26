<script>
import  Step  from './Step.svelte';
import  Iteration  from './Iteration.svelte';
import { fade } from 'svelte/transition';

export let gameState;
let iterations;
let step;

const nextStep = () => {
    gameState.nextStep();
    gameState=gameState;
}

</script>

<div class = "iterations">
    {#each gameState.iterations as i}
        <Iteration iterationCounter = {i.index} phase={i.phase}/>
    {/each}
</div>
<div>
    {#if gameState.getStep()}
        <div  transition:fade >
            <Step step = {gameState.getStep()} on:interact="{nextStep}"/>
        </div>
    {/if}
</div>

<style>
.iterations{
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-evenly;
}
</style>