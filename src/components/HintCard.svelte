<script>
    import Modal from './Modal.svelte';
    import refactorCards from "../content/refactorCards.json";
    import testCards from "../content/testCards.json";
    import codeCards from "../content/codeGuidanceCards.json";
    
    export let showHint = false;
    export let cardType = "";
    
    const allCards = { 
        refactor: refactorCards,
        test: testCards,
        code: codeCards
    };

    const typeTexts={
        refactor: "REFACTOR?",
        test: "TEST!",
        code: "IMPLEMENTATION!"
    };

    
    let show = false;
    let bodyText = "";
    let titleText = "";
    let typeText = "";
    

    function closeModal() {
		show = false;
	}
    $:{
        
        const cards = allCards[cardType];
        
        if(cards){
            if (showHint) show = true;
            typeText=typeTexts[cardType];

            let idx = Math.round((cards.length-1)*Math.random())
            console.log(idx);
            let card = cards[idx];
            bodyText = card.description;
            titleText = card.title;
        }
    }


</script>

<Modal  isOpenModal={show} {cardType} {titleText} {bodyText} {typeText} on:closeModal={closeModal}/>
