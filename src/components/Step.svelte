
<script>
    import HintCard from "./HintCard.svelte";
    import { tick } from 'svelte';
    export let step;
    let showHint = false;

    async function showCard(){
        showHint = true;
        await tick()
        showHint = false
    }
</script>

<div class = {step.classes}>
    <p class = "title">{step.title}</p>
    
    <div class ="stepBody">
        <p>{step.bodyText}</p>
        <button on:click={step.buttonAction}>{step.buttonText}</button>
        <button on:click={showCard}>Hint</button>
    </div>
    <HintCard {showHint}/>
</div>

<style>

.step{
  color: black;
  width: 100%;
  border-radius: 5px;
  border-width: 2px;
  border-style: solid;
  margin-top:10px;
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