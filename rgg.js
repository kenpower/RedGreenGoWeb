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
var iterationCounter = 1;
var iterationEl;
var curStep;

function startGame(){
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").style.display = "none";
    nextStep();

}

function nextStep() {
    if(curStep){
        iterationEl.removeChild(iterationEl.lastChild);
        addStepToIteration(curStep);
    }
    if(curState.name=="Red") {
        iterationEl = buildIterationElement();
        iterationCounter++;
        document.body.appendChild(iterationEl);
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
        "OK",
        nextStep,
        [curState.class, "step", "swap"]
    );

    curStep=newStep;
    iterationEl.appendChild(newStep);
}
  
  function addStep(state, stepNumber, driverName, navigatorName) {
    const newStep=buildStepElement(
        "Step:" + stepNumber + " " +state.name,
        (state.description + "    ("+ driverName + " is driving" 
        + ", " + navigatorName + " is navigating)"),
        "OK",
        nextStep,
        [state.class, "step"]
    );

    curStep=newStep;
    iterationEl.appendChild(newStep);
  }

  const buildStepElement = (title, bodyText, buttonText, buttonAction, classes) => {

    const newStep = document.createElement("div");
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

  const buildIterationElement = () => {
    const iteration = document.createElement("div");
    iteration.classList.add("iteration");
    const stepP = document.createElement("p");
    stepP.appendChild(document.createTextNode("Iteration: "+ iterationCounter));
    stepP.classList.add("title");
    const container = document.createElement("div");
    container.classList.add("container");
    container.id = "container";
 
    iteration.appendChild(stepP);
    iteration.appendChild(container);
    return iteration;
  }

  const addStepToIteration = (step)=>{
      iterationEl.children.namedItem("container").appendChild(step);
  }

