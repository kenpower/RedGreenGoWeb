<script>
    import Modal from './Modal.svelte';
    import refactorCards from "../content/refactorCards.json";
    
    export let showHint = false;
    let show = false;
    let bodyText = "";
    let titleText = "";

    function closeModal() {
		show = false;
	}
    $:{
        if (showHint) show = true;

        let idx = Math.round((refactorCards.length-1)*Math.random())
        console.log(idx);
        let card = refactorCards[idx];
        bodyText = card.description;
        titleText = card.title;
    }


</script>

<Modal  isOpenModal={show} {titleText} {bodyText} on:closeModal={closeModal}/>

<style>
    .title {
        color: #fff;
        background-color: #232323;
        text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18;
    }
</style>