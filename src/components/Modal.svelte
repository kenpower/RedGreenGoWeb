<!-- src/Modal.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';

    export let isOpenModal;
    export let bodyText = "";
    export let titleText = "";
  

  const dispatch = createEventDispatcher();

  function closeModal() {
      isOpenModal = false;
      dispatch('closeModal', { isOpenModal });
  }
 
</script>

<div    id="background" 
        style="display: {isOpenModal ? 'block' : 'none'};"  
        on:click={closeModal} >
        </div>

<div    id="frame" 
        style="display: {isOpenModal ? 'block' : 'none'};">
            <div id="modal">
                <div class = "cardType" >REFACTOR?</div>
              
                <div class = "title" >{titleText}</div>
                <div class = "bodyText" >{@html bodyText}</div>
            </div>
</div>

<style>
  #background {
      position: fixed;
      z-index: 1;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
              background: #000a;
  }
      #frame{
            border-radius:5px;
              position: fixed;
      z-index: 2;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ccf;
      }
   #modal {
       
      margin: 10px;
               max-height:70vh;
              overflow-y: auto;
     
  }

  .cardType {
        color: #558;
        font-family: 'Bangers', cursive;
        font-size: 3em;
        /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
        text-shadow: #2e2e2e 0 4px 5px;
    }

    .title {
        color: #000;
        font-family:'Montserrat', sans-serif;
        font-size: 4em;
        font-weight: 100;
        font-style: italic;
        /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
    }
    .bodyText {
        color: #000;
        font-family:'Montserrat', sans-serif;
        font-size: 1.5em;
        font-weight: 300;
  
        /* text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #49ff18, 0 0 30px #49ff18, 0 0 40px #49ff18, 0 0 55px #49ff18, 0 0 75px #49ff18; */
    }
</style>