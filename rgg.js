var states = [
    { name: "Red", ping_pong_swap:false, class: "red", next: 1, description:"Write the simplest test you can think of that will fail" },
    { name: "Green", ping_pong_swap:true, class: "green", next: 2 , description:"Write just enough code to make the failing test pass" },
    { name: "Refactor", ping_pong_swap:false, class: "refactor", next: 0,  description:"Clean up the code you've just written" }
  ];

var players = ["John", "Jane"];
  
var curState = states[0];
var curDriver = 0;
var curNavigator = 1;
var stepNumber = 1;

function startGame(){
    nextStep();
    //todo: disable start button
}
function swapPairRoles() {
    curDriver++;
    curNavigator++;
    curDriver %= 2;
    curNavigator %= 2;
    alert("Swapped roles");
}

function nextStep() {
    if(curState.ping_pong_swap){
        swapPairRoles()
    }
    addStep(curState, stepNumber, players[curDriver], players[curNavigator]);
    curState=states[curState.next];

    stepNumber++;
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