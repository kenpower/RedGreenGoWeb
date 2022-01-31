<script>
    import Modal from './Modal.svelte';
    import refactorCards from "../content/refactorCards.json";
    import testCards from "../content/testCards.json";
    import codeCards from "../content/codeGuidanceCards.json";
    let flipCardTwist = false;
    export let off = 0;
    let mv = off + "px";

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
        flipCardTwist = flipCardTwist;
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

<div class="flip-card"  class:flipCardTwist style="--mv: {mv};">
    <div class="flip-card-inner">
        <div class={"flip-card-front " + cardType} on:click={() => (flipCardTwist = true)}>
            <div class="content">
                <h1>Testing Inspiration Card</h1>
                <p>Stuck?<br/></p>
                <p>One of these cards might give you an idea to move forward</p>
            </div>
        </div>
        <div class={"flip-card-back " + cardType} on:click={() => (flipCardTwist = false)}  id="frame" >
            <div class = "modal" >
                <div class = "cardType" >{typeText}?</div>
                <div class = "title" >{titleText}</div>
                <div class = "bodyText" >{@html bodyText}</div>
            </div>
        </div>
    </div>
</div>

<style>
    * {
        --card-w: calc(var(--app-width) * 0.25);
        --card-h: calc(var(--card-w) * 1.5);
    }
    #frame.test{
        background-color: var(--testing-red);
        color:var(--testing-red-hint);
    }

    
    #frame.code{
        background-color: var(--coding-green);
        color:var(--coding-green-hint);

    }

    #frame.refactor{
        background-color: var(--refactoring-blue);
        color:var(--refactoring-blue-hint);
    }
   /* .modal {  
        margin: 10px;
        max-height:70vh;
        overflow-y: auto;
  } */

  .cardType {
        font-family: 'Bangers', cursive;
        font-size: 0.5em;
        /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
        text-shadow: #2e2e2e 0 4px 5px;
    }

    .title {

        font-family:'Montserrat', sans-serif;
        font-size: 0.8em;
        font-weight: 100;
        font-style: italic;
        /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
    }
    .bodyText {
        font-family:'Montserrat', sans-serif;
        font-size: 0.4em;
        font-weight: 300;
        overflow-y: auto;
        max-height: calc(var(--card-h) * 0.7);
  
        /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
    }

    .flip-card {
        position: absolute;
        top: var(--mv);
        left: var(--mv);

        width: var(--card-w);
        height: var(--card-h);

    }

    .flip-card-inner {
        position: absolute; 
        width: 100%;
        height: 100%;
        text-align: center;
        transition: all 0.6s; 
        transform-style: preserve-3d;
        box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
        background-color: white;
        border-radius:5px;
    }

    .flipCardTwist .flip-card-inner {

        /* --tx: calc(50vw - (var(--w) / 2)); */
        --tx: calc(50vw );
        --ty: calc(50vh - (var(--card-h) / 2));
        transform: 
            translate(var(--card-w), calc(var(--card-w) * -1)) 
            rotateY(180deg)
            scale(calc(3), calc(3))
            translateZ(+1px); 
            
    
    }

    .flip-card-front,
    .flip-card-back {
        position: absolute;
        width: calc(100% - 12px);
        height: calc(100% - 12px);
        backface-visibility: hidden;
    }

    .flip-card-front .content,
    .flip-card-back .content {
        padding: 6px;
    }

    .flip-card-front h1,
    .flip-card-back h1 {
        font-size: 1.1em;
        margin-top: 0.1em;
        margin-bottom: 0.1em;
    }

    .flip-card-front p,
    .flip-card-back p {
        font-size: 0.8em;
        margin-top: 0.1em;
        margin-bottom: 0.1em;
    }

    .code{ 
        --hero-col: var(--coding-green-hint);
        --accent-col: var(--coding-green-hint-trans);
        }
    .test{ 
        --hero-col: var(--testing-red-hint);
        --accent-col: var(--testing-red-hint-trans);
        }
    .refactor{ 
        --hero-col: var(--refactoring-blue-hint);
        --accent-col: var(--refactoring-blue-hint-trans);
        }
    .flip-card-front {
        border-radius: 5px;
        opacity: 0.6;
        opacity: 1;

        background-color: #fff;
        background-image:  linear-gradient(30deg, var(--hero-col) 12%, transparent 12.5%, transparent 87%, var(--hero-col) 87.5%, var(--hero-col)), 
                           linear-gradient(150deg, var(--hero-col) 12%, transparent 12.5%, transparent 87%, var(--hero-col) 87.5%, var(--hero-col)), 
                           linear-gradient(30deg, var(--hero-col) 12%, transparent 12.5%, transparent 87%, var(--hero-col) 87.5%, var(--hero-col)), 
                           linear-gradient(150deg, var(--hero-col) 12%, transparent 12.5%, transparent 87%, var(--hero-col) 87.5%, var(--hero-col)), 
                           linear-gradient(60deg, var(--accent-col) 25%, transparent 25.5%, transparent 75%, var(--accent-col) 75%, var(--accent-col)), 
                           linear-gradient(60deg, var(--accent-col) 25%, transparent 25.5%, transparent 75%, var(--accent-col) 75%, var(--accent-col));
        background-size: 30px 53px;
        background-position: 0 0, 0 0, 15px 26px, 15px 26px, 0 0, 15px 26px;
        border: solid;
        border-width: 1px;
        border-color: var(--coding-green);
        font-weight: bold;
        font-family: 'Zilla Slab', Consolas, 'Courier New', Courier, monospace;
         color: black;
        margin: 6px;
        text-shadow: 0px 0px 5px rgba(255, 255, 255, 1);
        }

    .flipCardTwist  .flip-card-back {
        left:4px;
        top:4px;
    }
    .flip-card-back {
        border-radius: 10px;
        background-color: #2980b9;
        color: white;
        transform:   rotateY(180deg);
        padding: 0.1em;
    }
</style>
