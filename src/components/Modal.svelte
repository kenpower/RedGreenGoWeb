<!-- src/Modal.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';

  export let isOpenModal;
    export let bodyText = "";
  

  const dispatch = createEventDispatcher();

  function closeModal() {
      isOpenModal = false;
      dispatch('closeModal', { isOpenModal });
  }
 
</script>

<div id="background" 
           style="display: {isOpenModal ? 'block' : 'none'};"  
        on:click={closeModal} ></div>
<div id="frame" style="display: {isOpenModal ? 'block' : 'none'};">
<div id="modal">
  <p>This is a modal window.</p>
      <p>
          {@html bodyText}
  </p>
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
      background: #fff;
      }
   #modal {
       
      margin: 10px;
               max-height:70vh;
              overflow-y: auto;
     
  }
</style>