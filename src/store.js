import { writable } from "svelte/store";

const initialGameState = {
    players : ["John", "Jane"],
    curDriver: 0,
    curNavigator: 1,
    curState : null,
    stepNumber : 1, 
    iterationCounter : 0,    
    curIterationIdx: 0,
    step :  null,
    steps : [],
    iterations : [],
    started: false,
};

const GAME_STATE = "GAME_STATE";
const copyOfInitialGameState = () => JSON.parse(JSON.stringify(initialGameState));

export const gameState = writable(
    localStorage[GAME_STATE] 
        ? JSON.parse(localStorage[GAME_STATE]) 
        : copyOfInitialGameState());
    
export const resetGame = () => {
    const gs = copyOfInitialGameState();
    gameState.set(gs);
    localStorage.setItem(GAME_STATE, JSON.stringify(gs))
}

gameState.subscribe(
    gs =>{
        localStorage.setItem(GAME_STATE, JSON.stringify(gs))
    }
);