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

<style>

.step{
  color: lightgray;
  width: 100%;
  border-radius: 5px;
  border-width: 2px;
  border-style: solid;
  max-width: 25%;
}

.step p{
  margin: 2;
}


.container .step .stepBody{
  padding: 5px;
  display: none;

}


.step .title{
  font-weight: bold;
  padding : 4px;
  margin: 0;
}
.red .title {
    background-color: #FC9999;
  }

.green .title {
    background-color: #99FC99;
  }

.refactor .title{
    background-color: #9999FC;
  } 

.red{
  border-color: red;
}

.green{
  border-color:green;
}

.refactor{
  border-color:blue;
}

.iteration{
  border-color: black;
  border-radius: 5px;
  border-width: 2px;
  border-style: solid;
  background-color: white;
  padding: 8px;
}
</style>