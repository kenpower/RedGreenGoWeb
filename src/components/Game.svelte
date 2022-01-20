<script>
import  Step  from './Step.svelte';
import  Iteration  from './Iteration.svelte';
import { fade } from 'svelte/transition';
import {gameState} from '../store.js';
import {nextStep} from '../gameLogic.js';


let iterations;
let step;

gameState.subscribe(gs => {
    iterations=gs.iterations;
    step=gs.step;
});

const handleStepButton= (message) =>{
    console.log(message)
    if(message.detail=="done"){
        nextStep();
    }
}
</script>


<div class = "iterations">
{#each iterations as i}
    <Iteration iterationCounter = {i.index} phase={i.phase}/>
{/each}
</div>
<div>
{#if step}
<div  transition:fade >
    <Step step = {step} on:interact="{handleStepButton}"/>
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