<script>
    let flipCardTwist = false;
    export let off = 0;
    let mv = off + "px";
</script>

<div class="flip-card"  class:flipCardTwist style="--mv: {mv};">
    <div class="flip-card-inner">
        <div class="flip-card-front" on:click={() => (flipCardTwist = true)}>
            <div class="content">
                <h1>Testing Inspiration</h1>
                <p>Stuck?</p>
                <p>One of these cards might give you an idea to move forward</p>
            </div>
        </div>
        <div class="flip-card-back" on:click={() => (flipCardTwist = false)}>
            <h1>John Doe</h1>
            <p>Architect & Engineer</p>
            <p>We love that guy</p>
        </div>
    </div>
</div>

<style>
    * {
        font-family: Arial, Helvetica, sans-serif;
    }

    .flip-card {
        position: absolute;
        top: var(--mv);
        left: var(--mv);
        background-color: transparent;
        --w: 18vw;
        --h: calc(var(--w) * 1.5);
        width: var(--w);
        height: var(--h);
    }

    .flip-card-inner {
        position: absolute; 
        width: 100%;
        height: 100%;
        text-align: center;
        transition: all 0.6s; 
        transform-style: preserve-3d;
        box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
    }

    .flipCardTwist .flip-card-inner {

        /* --tx: calc(50vw - (var(--w) / 2)); */
        --tx: calc(50vw );
        --ty: calc(50vh - (var(--h) / 2));
        transform: 
            translate(var(--w), 0) 
            rotateY(180deg)
            scale(calc(2), calc(2))
            translateZ(+1px); 
            
    
    }

    .flip-card-front,
    .flip-card-back {
        position: absolute;
        width: 100%;
        height: 100%;
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
    }

    .flip-card-front .content,
    .flip-card-back .content {
        padding: 6px;
    }

    .flip-card-front h1,
    .flip-card-back h1 {
        font-size: 1.5em;
    }

    .flip-card-front p,
    .flip-card-back p {
        font-size: 0.8em;
    }

    .flip-card-front {
        border-radius: 5px;

        background-color: #bbb;
        color: black;
    }

    .flip-card-back {
        border-radius: 10px;
        background-color: #2980b9;
        color: white;
        transform:   rotateY(180deg);
    }
</style>
