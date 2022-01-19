<script>
import  Step  from './Step.svelte';
import  Iteration  from './Iteration.svelte';
import { fade } from 'svelte/transition';

//export const iterations = writable([]);

var states = [
    { id: "red", title: "Make it Red", helpName: "test", class: "red", next: 1, description:"Write the simplest test you can think of that will fail" , buttonText: "Done: There is ONE failing (red) test"},
    { id: "swap", title: "Swap", helpName: "swap", class: "swap", next: 2, description:"Swap the roles of driver and navigator", buttonText: "" },
    { id: "green", title: "Make it Green",  helpName: "code", class: "green", next: 3 , description:"Write just enough code to make the failing test pass",  buttonText: "Done: All the test are now passing (green)" },
    { id: "refactor", title: "Make it Clean",  helpName: "refactor", class: "refactor", next: 0,  description:"Clean up the code you've just written" ,buttonText: "Done: The code is better and all tests are still passing!"},
];

export let players = ["John", "Jane"];
  
let curState = undefined
var curDriver = 0;
var curNavigator = 1;
var stepNumber = 1;
var iterationCounter = 0;
var curIteration;
var step = undefined;
let steps=[];
var iterations=[]


nextStep();
function add4Iterations(idx){
    iterations = [...iterations,
        {phase:1, index:idx++},
        {phase:0, index:idx++},
        {phase:0, index:idx++},
        {phase:0, index:idx++}
    ];
}

function nextStep() {
    step= new Object();

    curState = !curState ? states[0] : states[curState.next];


    if(curState.id=="red") {
        if(curIteration){
           curIteration.phase=4;
           iterationCounter++
        }

        if(iterationCounter >= iterations.length){
            add4Iterations(iterations.length+1);
        }
        
        curIteration =  iterations[iterationCounter]
        curIteration.phase=1;
        console.log(iterations)
    }

    if(curState.id=="green") {
        curIteration.phase = 2
       
        console.log(curIteration)
    }
    if(curState.id=="refactor") {
        curIteration.phase = 3
       
    }

    if(curState.id=="swap") {
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
        "Step:" + stepNumber + " " +state.title,
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


<div class = "iterations">
{#each iterations as i}
    <Iteration iterationCounter = {i.index} phase={i.phase}/>
{/each}
</div>
<div>
{#if step}
<div  transition:fade >
    <Step step = {step}/>
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