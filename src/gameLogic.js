import { get } from 'svelte/store';
import {gameState} from './store.js';

var states = [
    { id: "red", title: "Make it Red", helpName: "test", class: "red", next: 1, description:"Write the simplest test you can think of that will fail" , buttonText: "Done: There is ONE failing (red) test"},
    { id: "swap", title: "Swap", helpName: "swap", class: "swap", next: 2, description:"Swap the roles of driver and navigator", buttonText: "" },
    { id: "green", title: "Make it Green",  helpName: "code", class: "green", next: 3 , description:"Write just enough code to make the failing test pass",  buttonText: "Done: All the test are now passing (green)" },
    { id: "refactor", title: "Make it Clean",  helpName: "refactor", class: "refactor", next: 0,  description:"Clean up the code you've just written" ,buttonText: "Done: The code is better and all tests are still passing!"},
];


let gs=get(gameState); 
console.log(gs);

if(!gs.curState){ 
    gs.curState =  states[0];
    var its = get4Iterations(1);
    gs.iterations = [...gs.iterations, ...its];
    addStep(gs.curState, gs.stepNumber, gs.players[gs.curDriver], gs.players[gs.curNavigator]);
    gameState.set(gs)
}


function get4Iterations(idx){
    return[
        {phase:1, index:idx++},
        {phase:0, index:idx++},
        {phase:0, index:idx++},
        {phase:0, index:idx++}
    ];
}

export const nextStep = () => {
    let gs=get(gameState); 
    gs.curState = !gs.curState ? states[0] : states[gs.curState.next];


    if(gs.curState.id=="red") {
        gs.iterations[gs.curIterationIdx].phase=4;
        gs.iterationCounter++
    

        if( gs.iterationCounter >= gs.iterations.length){
            const its = get4Iterations(gs.iterations.length+1);
            gs.iterations = [...gs.iterations, ...its];
        }
        
        gs.curIterationIdx =  gs.iterationCounter
        gs.iterations[gs.curIterationIdx].phase=1;
        console.log(gs.iterations)
    }

    if(gs.curState.id=="green") {
        gs.iterations[gs.curIterationIdx].phase = 2
    }
    if(gs.curState.id=="refactor") {
        gs.iterations[gs.curIterationIdx].phase = 3
    }

    if(gs.curState.id=="swap") {
        gs.iterations[gs.curIterationIdx].phase = 2
        swapPairRoles();
    }
    else{
        addStep(gs.curState, gs.stepNumber, gs.players[gs.curDriver], gs.players[gs.curNavigator]);
        gs.stepNumber++;
    }
    
    gameState.set(gs)
}

function swapPairRoles() {
    let gs=get(gameState); 
    gs.curDriver++;
    gs.curNavigator++;
    gs.curDriver %= 2;
    gs.curNavigator %= 2;
    buildStepObject(
        "Swap pair programming roles",
        gs.players[gs.curDriver] + " is now the driver and " + gs.players[gs.curNavigator] + " is the navigator",
        "Done:" + gs.players[gs.curDriver] + " has the keyboard",
        ""+ gs.curState.class+" step swap",
        "swap"
    );
    gameState.set(gs)
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
        let gs=get(gameState);
        var step= new Object();
        step = {title, bodyText, buttonText, classes, helpName};
        step.x=42
        //steps.push(step)
        gs.steps=[...gs.steps, step]
        //curStep = step;
        //console.log(step)
        gs.step =  step

        gameState.set(gs)
  }
