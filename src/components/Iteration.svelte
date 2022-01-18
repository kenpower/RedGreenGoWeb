<script>
    import TDDCycle from "./TDDCycle.svelte";
    export let iterationCounter = 0
    export let phase = 0
</script>

<div class="iteration">
    <TDDCycle phase = {phase} text={iterationCounter}></TDDCycle>
    <p class="title">
        Iteration: {iterationCounter}
    </p>
</div>

<style>
.iteration{
  border-color: black;
  border-radius: 5px;
  border-width: 2px;
  border-style: solid;
  background-color: white;
  padding: 8px;
}



</style>