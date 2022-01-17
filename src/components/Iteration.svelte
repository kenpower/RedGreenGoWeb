<script>
    export let iterationCounter
</script>

<div class="iteration">
    <p class="title">
        Iteration: {iterationCounter}
    </p>
    <div class =  "container" id = "container">

    </div>
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
.iteration #container{
  display: flex;
}


</style>