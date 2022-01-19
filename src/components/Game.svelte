<script>
import  Step  from './Step.svelte';
import  Iteration  from './Iteration.svelte';
import { fade } from 'svelte/transition';
import {gameState} from '../store.js';


var states = [
    { id: "red", title: "Make it Red", helpName: "test", class: "red", next: 1, description:"Write the simplest test you can think of that will fail" , buttonText: "Done: There is ONE failing (red) test"},
    { id: "swap", title: "Swap", helpName: "swap", class: "swap", next: 2, description:"Swap the roles of driver and navigator", buttonText: "" },
    { id: "green", title: "Make it Green",  helpName: "code", class: "green", next: 3 , description:"Write just enough code to make the failing test pass",  buttonText: "Done: All the test are now passing (green)" },
    { id: "refactor", title: "Make it Clean",  helpName: "refactor", class: "refactor", next: 0,  description:"Clean up the code you've just written" ,buttonText: "Done: The code is better and all tests are still passing!"},
];

//nextStep();
console.log($gameState);

if(!$gameState.curState){ 
    $gameState.curState =  states[0];
    add4Iterations(1);
    addStep($gameState.curState, $gameState.stepNumber, $gameState.players[$gameState.curDriver], $gameState.players[$gameState.curNavigator]);
}
console.log($gameState)

function add4Iterations(idx){
    $gameState.iterations = [...$gameState.iterations,
        {phase:1, index:idx++},
        {phase:0, index:idx++},
        {phase:0, index:idx++},
        {phase:0, index:idx++}
    ];
}

function nextStep() {

    $gameState.curState = !$gameState.curState ? states[0] : states[$gameState.curState.next];


    if($gameState.curState.id=="red") {
        $gameState.iterations[$gameState.curIterationIdx].phase=4;
        $gameState.iterationCounter++
    

        if( $gameState.iterationCounter >= $gameState.iterations.length){
            add4Iterations($gameState.iterations.length+1);
        }
        
        $gameState.curIterationIdx =  $gameState.iterationCounter
        $gameState.iterations[$gameState.curIterationIdx].phase=1;
        console.log($gameState.iterations)
    }

    if($gameState.curState.id=="green") {
        $gameState.iterations[$gameState.curIterationIdx].phase = 2
    }
    if($gameState.curState.id=="refactor") {
        $gameState.iterations[$gameState.curIterationIdx].phase = 3
    }

    if($gameState.curState.id=="swap") {
        $gameState.iterations[$gameState.curIterationIdx].phase = 2
        swapPairRoles();
    }
    else{
        addStep($gameState.curState, $gameState.stepNumber, $gameState.players[$gameState.curDriver], $gameState.players[$gameState.curNavigator]);
        $gameState.stepNumber++;
    }
    $gameState.iterations=$gameState.iterations
}

function swapPairRoles() {
    $gameState.curDriver++;
    $gameState.curNavigator++;
    $gameState.curDriver %= 2;
    $gameState.curNavigator %= 2;
    buildStepObject(
        "Swap pair programming roles",
        $gameState.players[$gameState.curDriver] + " is now the driver and " + $gameState.players[$gameState.curNavigator] + " is the navigator",
        "Done:" + $gameState.players[$gameState.curDriver] + " has the keyboard",
        ""+ $gameState.curState.class+" step swap",
        "swap"
    );
}
  
  function addStep(state, stepNumber, driverName, navigatorName) {
    buildStepObject(
        "Step:" + stepNumber + " " +state.title,
        (state.description + "    ("+ driverName + " is driving" + ", " + navigatorName + " is navigating)"),
        state.buttonText,
        ""+state.class+ " step",
        state.helpName
    );

  }

  function buildStepObject(title, bodyText, buttonText, classes, helpName) {
        var step= new Object();
        step = {title, bodyText, buttonText, classes, helpName};
        step.x=42
        //steps.push(step)
        $gameState.steps=[...$gameState.steps, step]
        //curStep = step;
        //console.log(step)
        $gameState.step =  step
  }

  const handleStepButton= (message) =>{
    console.log(message)
    if(message.detail=="done"){
        nextStep();
    }
  }
</script>


<div class = "iterations">
{#each $gameState.iterations as i}
    <Iteration iterationCounter = {i.index} phase={i.phase}/>
{/each}
</div>
<div>
{#if $gameState.step}
<div  transition:fade >
    <Step step = {$gameState.step} on:interact="{handleStepButton}"/>
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