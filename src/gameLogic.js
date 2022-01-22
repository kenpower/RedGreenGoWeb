import { get } from 'svelte/store';
import {gameState, resetGame} from './store.js';

var states = [
    { id: "red", title: "Make it Red", helpName: "test", class: "red", next: 1, description:"Write the simplest test you can think of that will fail" , buttonText: "Done: There is ONE failing (red) test"},
    { id: "swap", title: "Swap", helpName: "swap", class: "swap", next: 2, description:"Swap the roles of driver and navigator", buttonText: "" },
    { id: "green", title: "Make it Green",  helpName: "code", class: "green", next: 3 , description:"Write just enough code to make the failing test pass",  buttonText: "Done: All the test are now passing (green)" },
    { id: "refactor", title: "Make it Clean",  helpName: "refactor", class: "refactor", next: 0,  description:"Clean up the code you've just written" ,buttonText: "Done: The code is better and all tests are still passing!"},
];


export const reStartGame= () => {
    resetGame();
}

export const startGame= () => {
    
    let gs=get(gameState); 
    gs.started=true;
    if(!gs.curState){ 
        gs.curState = states[0];
        gs.iterations = get4Iterations(1);
        addStep(gs, gs.curState, gs.stepNumber, gs.players[gs.curDriver], gs.players[gs.curNavigator]);
    }
    
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
        addStep(gs, gs.curState, gs.stepNumber, gs.players[gs.curDriver], gs.players[gs.curNavigator]);
        gs.stepNumber++;
    }
    
    gameState.set(gs)
}

function swapPairRoles() {
    let gs = get(gameState); 
    gs.curDriver++;
    gs.curNavigator++;
    gs.curDriver %= 2;
    gs.curNavigator %= 2;
    const step = buildStepObject(
        "Swap pair programming roles",
        gs.players[gs.curDriver] + " is now the driver and " + gs.players[gs.curNavigator] + " is the navigator",
        "OK:" + gs.players[gs.curDriver] + " has the keyboard",
        ""+ gs.curState.class+" step swap",
        "swap",
        gs.players[gs.curDriver],
        gs.players[gs.curNavigator]

    );
    gs.steps=[...gs.steps, step]
    gs.step =  step
    gameState.set(gs)
}
  
function addStep(gs, state, stepNumber, driverName, navigatorName) {
     const step = buildStepObject(
        "Step:" + stepNumber + " " +state.title,
        state.description,
        state.buttonText,
        ""+state.class+ " step",
        state.helpName,
        driverName,
        navigatorName
    );
    gs.steps=[...gs.steps, step]
    gs.step =  step
}

function buildStepObject(title, bodyText, buttonText, classes, helpName, driver, navigator) {
    const step = {title, bodyText, buttonText, classes, helpName, driver, navigator};
    return step
}
