<script>
    import TDDCycle from "./TDDCycle.svelte";
    export let iterationCounter = 0
    export let phase = 0
    let dimmed = false
    $: dimmed = phase==0 || phase ==4
</script>

<div class="iteration" class:dimmed>
    <div class="overlay"/>
    <TDDCycle size={100} phase = {phase} text={iterationCounter}></TDDCycle>
    <p class="title">
        {dimmed ? "" : "Iteration: "+ iterationCounter}
    </p>
</div>

<style>
.iteration{
  /* border-color: black; */
  border-radius: 5px;
  /* border-width: 2px; */
  /* border-style: solid; */
  background-color: #eee;
  padding: 8px;
  max-width: calc(var(--global-game-width)/5);
  position:relative;
}

.dimmed .overlay{
  position: absolute;
    top:0;
    left:0;
    width:100%;
    height:100%;
    opacity:0.7;
    background:#fff;
    text-align:center;
}

</style>