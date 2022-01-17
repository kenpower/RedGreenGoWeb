<script>
import  Step  from './Step.svelte';
import  Iteration  from './Iteration.svelte';

//export const iterations = writable([]);

var states = [
    { name: "Red",  class: "red", next: 1, description:"Write the simplest test you can think of that will fail" , buttonText: "Done: There is ONE failing (red) test"},
    { name: "Swap", class: "swap", next: 2, description:"Swap the roles of driver and navigator", buttonText: "Done: All the test are now passing (green)" },
    { name: "Green",  class: "green", next: 3 , description:"Write just enough code to make the failing test pass",  },
    { name: "Refactor",  class: "refactor", next: 0,  description:"Clean up the code you've just written" ,buttonText: "Done: The code is better and all tests are still passing!"},
];

var players = ["John", "Jane"];
  
var curState = states[0];
var curDriver = 0;
var curNavigator = 1;
var stepNumber = 1;
var iterationCounter = 1;
var iterationEl;
var curStep;
var steps=[];
var iterations=[];


function startGame(){
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").style.display = "none";
    nextStep();

}

function nextStep() {
    if(curStep){
        //iterationEl.removeChild(iterationEl.lastChild);
        addStep(curState, stepNumber, players[curDriver], players[curNavigator]);
        stepNumber++;
    }
    if(curState.name=="Red") {
        iterations.push(iterationCounter)
        iterations=iterations
        iterationCounter++;
    }
    if(curState.name=="Swap") {
        swapPairRoles();
    }
    else{
        addStep(curState, stepNumber, players[curDriver], players[curNavigator]);
        stepNumber++;
    }
    curState=states[curState.next];
    
}

function swapPairRoles() {
    curDriver++;
    curNavigator++;
    curDriver %= 2;
    curNavigator %= 2;
    const newStep=buildStepElement(
        "Swap pair programming roles",
        players[curDriver] + " is now the driver and " + players[curNavigator] + " is the navigator",
        "Done:" + players[curDriver] + " has the keyboard",
        nextStep,
        [curState.class, "step", "swap"]
    );

    curStep=newStep;
    //iterationEl.appendChild(newStep);
}
  
  function addStep(state, stepNumber, driverName, navigatorName) {
    const newStep=buildStepElement(
        "Step:" + stepNumber + " " +state.name,
        (state.description + "    ("+ driverName + " is driving" 
        + ", " + navigatorName + " is navigating)"),
        state.buttonText,
        nextStep,
        [state.class, "step"]
    );

    curStep=newStep;
    // iterationEl.appendChild(newStep);
  }

  const buildStepElement = (title, bodyText, buttonText, buttonAction, classes) => {

        steps.push({title, bodyText, buttonText, buttonAction, classes})
        steps=steps

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
<div>
{#each iterations as i}
    <Iteration iterationCounter = {i}/>
{/each}

{#each steps as step}
<Step {step}/>
{/each}
</div>

<style>
</style>