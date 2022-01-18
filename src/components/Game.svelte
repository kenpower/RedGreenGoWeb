<script>
import  Step  from './Step.svelte';
import  Iteration  from './Iteration.svelte';
import { SvelteComponentTyped } from 'svelte/internal';

//export const iterations = writable([]);

var states = [
    { name: "Red", helpName: "test", class: "red", next: 1, description:"Write the simplest test you can think of that will fail" , buttonText: "Done: There is ONE failing (red) test"},
    { name: "Swap", helpName: "swap", class: "swap", next: 2, description:"Swap the roles of driver and navigator", buttonText: "" },
    { name: "Green",  helpName: "code", class: "green", next: 3 , description:"Write just enough code to make the failing test pass",  buttonText: "Done: All the test are now passing (green)" },
    { name: "Refactor",  helpName: "refactor", class: "refactor", next: 0,  description:"Clean up the code you've just written" ,buttonText: "Done: The code is better and all tests are still passing!"},
];

var players = ["John", "Jane"];
  
let curState = undefined
var curDriver = 0;
var curNavigator = 1;
var stepNumber = 1;
var iterationCounter = 1;
var curIteration;
var step = undefined;
let steps=[];
var iterations=[];

function startGame(){
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").style.display = "none";
    nextStep();
}

function nextStep() {
    step= new Object();
    if(!curState){
      curState = states[0]
    }
    else{
      curState=states[curState.next];
    }

    if(curState.name=="Red") {
        if(curIteration){
           curIteration.phase=4;
        }
        curIteration =  {phase:1, index:iterationCounter}
        iterations=[...iterations, curIteration]
        iterationCounter++;
        console.log(iterations)
    }

    if(curState.name=="Green") {
        curIteration.phase = 2
       
        console.log(curIteration)
    }
    if(curState.name=="Refactor") {
        curIteration.phase = 3
       
    }

    if(curState.name=="Swap") {
        curIteration.phase = 2
        swapPairRoles();
    }
    else{
        addStep(curState, stepNumber, players[curDriver], players[curNavigator]);
        stepNumber++;
    }
    iterations=iterations
}

function swapPairRoles() {
    curDriver++;
    curNavigator++;
    curDriver %= 2;
    curNavigator %= 2;
    step = buildStepObject(
        "Swap pair programming roles",
        players[curDriver] + " is now the driver and " + players[curNavigator] + " is the navigator",
        "Done:" + players[curDriver] + " has the keyboard",
        nextStep,
        ""+ curState.class+" step swap",
        "swap"
    );
}
  
  function addStep(state, stepNumber, driverName, navigatorName) {
    step = buildStepObject(
        "Step:" + stepNumber + " " +state.name,
        (state.description + "    ("+ driverName + " is driving" + ", " + navigatorName + " is navigating)"),
        state.buttonText,
        nextStep,
        ""+state.class+ " step",
        state.helpName
    );

  }

  function buildStepObject(title, bodyText, buttonText, buttonAction, classes, helpName) {
        step= new Object();
        step = {title, bodyText, buttonText, buttonAction, classes, helpName};
        step.x=42
        //steps.push(step)
        steps=[...steps, step]
        //curStep = step;
        //console.log(step)
        return step
  }

  const addStepToIteration = (step)=>{
      //iterationEl.children.namedItem("container").appendChild(step);
  }

</script>

<h1>Red-Green-Go!</h1>
<h2>A game of TDD & Pairing</h2>    
<section>
<form >
    <label for="fname">Player 1 name:</label>
    <input type="text" id="fname" name="fname" value="John"><br>
    <label for="lname">Player 2 name:</label>
    <input type="text" id="lname" name="lname" value="Jane"><br>
    <input id="startBtn" name="Submit" type="submit" value="Start" on:click={startGame}/>
    </form>
</section>
<div class = "iterations">
{#each iterations as i}
    <Iteration iterationCounter = {i.index} phase={i.phase}/>
{/each}
</div>
<div>
{#if step}
    <Step step = {step}/>
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