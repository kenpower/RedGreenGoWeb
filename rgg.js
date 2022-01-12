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

function swapPairRoles() {
    curDriver++;
    curNavigator++;
    curDriver %= 2;
    curNavigator %= 2;
    const newStep=buildStepElement(
        "Swap pair programming roles",
        players[curDriver] + " is now the driver and " + players[curNavigator] + " is the navigator",
        "OK",
        nextStep,
        [curState.class, "step", "swap"]
    );

    document.body.appendChild(newStep);
}
  
  function addStep(state, stepNumber, driverName, navigatorName) {
    const newStep=buildStepElement(
        "Step:" + stepNumber + " " +state.name,
        (state.description + "    ("+ driverName + " is driving" 
        + "," + navigatorName + " is navigating)"),
        "OK",
        nextStep,
        [state.class, "step"]
    );


    document.body.appendChild(newStep);
  }

  const buildStepElement = (title, bodyText, buttonText, buttonAction, classes) => {

    const newStep = document.createElement("section");
    classes.forEach(c => {
        newStep.classList.add(c);
    });

    const newStepBody = document.createElement("div");
    newStepBody.classList.add("stepBody");
 
    const stepP = document.createElement("p");
    stepP.appendChild(document.createTextNode(title));
    stepP.classList.add("title");
 
    const descP = document.createElement("p");
    descP.appendChild(document.createTextNode(bodyText));
  
    doneBtn = document.createElement("button") ;
    doneBtn.innerHTML = buttonText;
    doneBtn.onclick = buttonAction;
    
    newStepBody.appendChild(descP);
    newStepBody.appendChild(doneBtn);
    
    newStep.appendChild(stepP);
    newStep.appendChild(newStepBody);
    return newStep;
  }