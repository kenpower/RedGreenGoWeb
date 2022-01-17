<script>
    export let step;

    const {title, bodyText, buttonText, buttonAction, classes} = step
    
    let classesStr=""
    console.log(classes)
    classes.forEach(c => classesStr += (c + " "))
    
</script>

<div class = {classesStr}>
    <p class = "title">{title}</p>
    
    <div class ="stepBody">
        <p>{bodyText}</p>
        <button on:click={buttonAction}>{buttonText}</button>
    </div>
</div>
    <!-- const newStep = document.createElement("div");
    classes.forEach(c => {
        newStep.classList.add(c);
    }); -->

    <!-- const newStepBody = document.createElement("div");
    newStepBody.classList.add("stepBody"); -->
 
    <!-- const stepP = document.createElement("p");
    stepP.appendChild(document.createTextNode(title));
    stepP.classList.add("title"); -->
 
    <!-- const descP = document.createElement("p");
    descP.appendChild(document.createTextNode(bodyText)); -->
  
    <!-- doneBtn = document.createElement("button") ;
    doneBtn.innerHTML = buttonText;
    doneBtn.onclick = buttonAction; -->
    
    <!-- newStepBody.appendChild(descP);
    newStepBody.appendChild(doneBtn); -->
    
    <!-- newStep.appendChild(stepP);
    newStep.appendChild(newStepBody);
    return newStep;
  } -->