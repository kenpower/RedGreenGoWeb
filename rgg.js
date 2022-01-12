var states = [
    { name: "Red", class: "red", next: 1, description:"Write the simplest test you can think of that will fail" },
    { name: "Green", class: "green", next: 2 , description:"Write just enough code to make the failing test pass" },
    { name: "Refactor", class: "refactor", next: 0,  description:"Clean up the code you've just written" }
  ];

var players = ["John", "Jane"];
  
var curState = states[0];
var curDriver = 0;
var curNavigator = 1;
var stepNumber = 1;
  
  function nextStep() {
    addStep(curState, stepNumber, players[curDriver], players[curNavigator]);
    curState=states[curState.next];
    curDriver++;
    curNavigator++;
    curDriver %= 2;
    curNavigator %= 2;
    stepNumber++;
  }
  
  function addStep(state, stepNumber, driverName, navigatorName) {
    // create a new div element
    const newStep = document.createElement("section");
    newStep.classList.add(state.class);
    newStep.classList.add("step");
  
    // and give it some content
    const newContent = document.createTextNode(state.name);
 
    const stepP = document.createElement("p");
    stepP.appendChild(document.createTextNode("Step:" + stepNumber));
    stepP.appendChild(document.createTextNode(" "+state.name));
 
    const descP = document.createElement("p");
    descP.appendChild(document.createTextNode(state.description));
 

    const roleP = document.createElement("p");
    roleP.appendChild(document.createTextNode("Driver is : "+driverName+",      Navigator is : "+navigatorName));
  
    doneBtn = document.createElement("button") ;
    doneBtn.innerHTML = "Done " + "step " + stepNumber;
    doneBtn.onclick = nextStep;
    // add the text node to the newly created div
    newStep.appendChild(stepP);
    newStep.appendChild(descP);
    newStep.appendChild(roleP);
    newStep.appendChild(doneBtn);
    
    document.body.appendChild(newStep);
  
  }