<script>
  import Game from "./components/Game.svelte";
  import IconButton from "./components/IconButton.svelte";
  //import {gameState} from './store.js';
  //import {reStartGame, startGame} from './gameLogic.js';
  import { GameState } from "./gameState";
  import { fly } from "svelte/transition";

  let thirdPlayer;
  let gameState = GameState.recoverSavedGame();
  if (!gameState) {
    gameState = new GameState();
  }
  const startGame = () => {
    if (thirdPlayer) gameState.players[2] = thirdPlayer;
    gameState.start();
    gameState = gameState;
  };

  const reStartGame = () => {
    gameState = new GameState();
  };

  let file = "waiting";
  
  const read_stream = async (stream) => {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let result = '';

    // Read the stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break; // Stream is finished

      // Decode the Uint8Array to string
      result += decoder.decode(value, { stream: true });
    }

    // Finalize the decoding
    result += decoder.decode(); // Flush any remaining data

    return result;
  }
  const g = async () => {
    try {
      const response = await fetch('http://localhost:8000/data');
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await read_stream(response.body);
      //const data = await response.json(); // Parse JSON data
      file = data; // Update file with the fetched data
      console.log(data); // Handle the data
    } catch (error) {
      console.error('There has been a problem with your fetch operation:', error);
    }
}

g();

</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Bangers&family=Montserrat:ital,wght@0,300;0,500;1,100;1,300;1,500&family=Roboto+Mono:ital,wght@0,277;0,300;1,300&family=Zilla+Slab:wght@300;400;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>
<title>Red Green Go!</title>

<main>
  <header>
    <div class="menu">
      <IconButton onclick={reStartGame} icon="restart" />
    </div>
    <div class="title">
      <svg xmlns="http://www.w3.org/2000/svg">
        <filter id="motion-blur-filter" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="10 0" />
          <feOffset dx="5" />
          <feMorphology operator="erode" radius="1" />
        </filter>
      </svg>
      <span id="red">Red</span>-<span id="green">Green</span>-<span
        filter-content="G"
        class="swoosh"
        id="blue">G</span
      ><span id="blue">o!</span>
    </div>
    <div class="menu">x</div>
  </header>

  <h2>A game of TDD & Pairing</h2>

  <section>
    {#if gameState.started}
      <div in:fly={{ y: 200, duration: 2000 }}>
        <Game {gameState} />
      </div>
    {:else}
      <p>
        Test Driven Development (TDD) is a process for writing code that
        involves repeatedly appying three distinct steps:
      </p>
      <ol>
        <li>
          <p>
            Describe one very simple thing what your code <strong>should</strong
            >
            do. We write this description in a <em>"test"</em>. A test is a
            special function that can check if a single peice of code does what
            you say it should do.
          </p>
          <p>
            After you write the test, the test will fail, but that is OK as you
            won't have written the code yet.
          </p>
        </li>
        <li>
          The next step is to to write enough code that will make the test pass.
          You don't have to write very much, nor do you have to write clever
          code. You can even hard code in results that will pass the test. The
          code written at this stage will usually be low quality, and specifit
          to the test. But that is ok, we will get a chance to improve the code
          later on. During this step the important thing is to get the test
          passing.
        </li>
        <li>
          Once the test is passing (green), the final step in the cycle is
          refactoring. This is where we look at the code we just wrote and try
          to find patterns that we can use to make the code more general. We
          will repeat these three steps with tests covering more and more of the
          required behaviour.
        </li>
      </ol>
      <div>
        <span>
          <label for="name1">Player 1 (required)</label>
          <input
            type="text"
            id="name1"
            name="name1"
            required
            bind:value={gameState.players[0]}
          /><br />
        </span>
        <span>
          <label for="name2">Player 2 (required)</label>
          <input
            type="text"
            id="name2"
            name="name2"
            required
            bind:value={gameState.players[1]}
          /><br />
        </span>
        <span>
          <label for="name3">Player 3 (Optional)</label>
          <input
            type="text"
            id="name3"
            name="name3"
            bind:value={thirdPlayer}
          /><br />
        </span>

        <button id="startBtn" on:click={startGame}>Start Game</button>
      </div>
    {/if}
  </section>
</main>
<p>My File:</p>
{file}

<style>
  :global(*) {
    --app-width: 500px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-tone-2);
  }

  .title {
    font-size: 2.5em;
    font-weight: bold;
  }

  h2 {
    font-size: 1.5em;
    margin: 0.25em;
    font-weight: 200;
  }

  main {
    text-align: center;
    padding: 1em;
    max-width: var(--app-width);
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    color: var(--color-tone-2);
    font-weight: 200;
  }

  li {
    text-align: justify;
  }

  label {
    display: inline-block;
    min-width: 10rem;
    text-align: right;
  }

  #red {
    color: var(--testing-red);
  }

  #green {
    color: var(--coding-green);
  }

  #blue {
    color: var(--refactoring-blue);
    font-style: italic;
    transform: skew(45deg, 50deg);
  }

  .swoosh::before {
    content: attr(filter-content);
    filter: url(#motion-blur-filter);
  }

  svg {
    display: none;
  }

  :global(*) {
    --global-game-width: 500px;
    --testing-red: tomato;
    /* SVG tomato #FF6347 */
    --testing-red-muted: #ffa899;
    --testing-red-hint: #ffdcd6;
    --testing-red-hint-trans: #ffdcd677;
    --coding-green: olivedrab;
    /* SVG olivedrab #6B8E23	 */
    --coding-green-muted: #a5d24b;
    --coding-green-hint: #cee79d;
    --coding-green-hint-trans: #cee79d77;
    --refactoring-blue: dodgerblue;
    /*dodgerblue #1E90FF	 */
    --refactoring-blue-muted: #85c2ff;
    --refactoring-blue-hint: #d6ebff;
    --refactoring-blue-hint-trans: #d6ebff77;

    --color-tone-1: #1a1a1b;
    --color-tone-2: #787c7e;
    --color-tone-3: #878a8c;
    --color-tone-4: #d3d6da;
    --color-tone-5: #edeff1;
    --color-tone-6: #f6f7f8;
    --color-tone-7: #ffffff;
    --opacity-50: rgba(255, 255, 255, 0.5);
  }

  :global(html) {
    /* THE TRICK to stop scroll bar appearing and moving everything to the left */
    margin-left: calc(100vw - 100%);
  }
</style>
