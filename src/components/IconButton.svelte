<script>
    import Icon from "./Icon.svelte";
    export let icon=""
    export let onclick=()=>{
        console.log("clicked")
    }
    
</script>

<button on:click={onclick}>
    <Icon {icon} ></Icon> 
</button>
<style>

button{
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 4px;
    margin: 0;
    display: flex;
    align-items: center;
} 
</style>