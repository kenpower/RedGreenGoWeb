var states = [
    { name: "Red",  class: "red", next: 1, description:"Write the simplest test you can think of that will fail" },
    { name: "Swap", class: "swap", next: 2, description:"Swap the roles of driver and navigator" },
    { name: "Green",  class: "green", next: 3 , description:"Write just enough code to make the failing test pass" },
    { name: "Refactor",  class: "refactor", next: 0,  description:"Clean up the code you've just written" },
];

var players = ["John", "Jane"];
  
var curState = states[0];
var curDriver = 0;
var curNavigator = 1;
var stepNumber = 1;

function startGame(){
    nextStep();
    document.getElementById("startBtn").disabled = true;
}
function swapPairRoles() {
    curDriver++;
    curNavigator++;
    curDriver %= 2;
    curNavigator %= 2;
    const swapEl = document.createElement("section");
    swapEl.classList.add("swap");
    swapEl.classList.add("step");
    swapEl.appendChild(document.createTextNode(curState.description));
    swapBtn = document.createElement("button") ;
    swapBtn.innerHTML = "OK";
    swapBtn.onclick = nextStep;
    swapEl.appendChild(swapBtn);
    document.body.appendChild(swapEl);
}


function nextStep() {
    if(curState.name=="Swap") {
        swapPairRoles();
    }
    else{
        addStep(curState, stepNumber, players[curDriver], players[curNavigator]);
        stepNumber++;
    }
    curState=states[curState.next];

}
  
  function addStep(state, stepNumber, driverName, navigatorName) {
    // create a new div element
    const newStep = document.createElement("section");
    newStep.classList.add(state.class);
    newStep.classList.add("step");
  
    const newStepBody = document.createElement("div");
    newStepBody.classList.add("stepBody");
 
    const stepP = document.createElement("p");
    stepP.appendChild(document.createTextNode("Step:" + stepNumber));
    stepP.appendChild(document.createTextNode(" "+state.name));
    stepP.classList.add("title");
 
 
    const descP = document.createElement("p");
    descP.appendChild(document.createTextNode(state.description));
 

    const roleP = document.createElement("p");
    roleP.appendChild(document.createTextNode("Driver is : "+driverName+",      Navigator is : "+navigatorName));
  
    doneBtn = document.createElement("button") ;
    doneBtn.innerHTML = "Done " + "step " + stepNumber;
    doneBtn.onclick = nextStep;
    // add the text node to the newly created div
    
    newStepBody.appendChild(descP);
    newStepBody.appendChild(roleP);
    newStepBody.appendChild(doneBtn);
    
    newStep.appendChild(stepP);
    newStep.appendChild(newStepBody);
    document.body.appendChild(newStep);
  
  }

  const buildStepElement = (title, bodyText, buttonText, buttonAction, classes) => {
  }