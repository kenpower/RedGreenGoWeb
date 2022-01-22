<script>
    export let icon = "";
    export let size = "20px";
    
    let urls={
        "restart": "icons/restart.png",
        "driving": "icons/driving.png",
        "navigation": "icons/navigation.png",
        "keyboard": "icons/keyboard.png",
        
    }

    let alts={
        "restart": "Restart Game",
        "driving": "Driver",
        "navigation": "Navigator",
        "keyboard": "Keyboard",
        
    }

</script>
<img style="--size: {size}"
    src = {urls[icon]}
    alt =  {alts[icon]}
    title = {alts[icon]}>

<style> 

img{
    height: var(--size);
    width: var(--size);
}
</style>