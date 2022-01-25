<script>

import { createEventDispatcher } from 'svelte';

const dispatch = createEventDispatcher();


const FULL_DASH_ARRAY = 283;
const WARNING_THRESHOLD = 10;
const ALERT_THRESHOLD = 5;

const COLOR_CODES = {
  info: {
    color: "red"
  },
  warning: {
    color: "orange",
    threshold: WARNING_THRESHOLD
  },
  alert: {
    color: "green",
    threshold: ALERT_THRESHOLD
  }
};

export let text = "OK"
const TIME_LIMIT = 2;
let timePassed = 0;
let timeLeft = TIME_LIMIT;
let timerInterval = null;
let timeUp=false;

let red = false;
let orange = false;
let green = true;

startTimer();

function onTimesUp() {
  clearInterval(timerInterval);
  timeUp=true;
}

function startTimer() {
  timerInterval = setInterval(() => {
    timePassed = timePassed += 1;
    timeLeft = TIME_LIMIT - timePassed;
    setCircleDasharray();
    setRemainingPathColor(timeLeft);

    if (timeLeft === 0) {
      onTimesUp();
    }
  }, 1000);
}

function formatTime(time) {
  const minutes = Math.floor(time / 60);
  let seconds = time % 60;

  if (seconds < 10) {
    seconds = `0${seconds}`;
  }

  return `${minutes}:${seconds}`;
}

function setRemainingPathColor(timeLeft) {
  const { alert, warning, info } = COLOR_CODES;
  if (timeLeft <= alert.threshold) {
    orange=false
    red=true
  } else if (timeLeft <= warning.threshold) {
    green=false
    orange=true
  }
}

function calculateTimeFraction() {
  const rawTimeFraction = timeLeft / TIME_LIMIT;
  return rawTimeFraction - (1 / TIME_LIMIT) * (1 - rawTimeFraction);
}

function setCircleDasharray() {
  const circleDasharray = `${(
    calculateTimeFraction() * FULL_DASH_ARRAY
  ).toFixed(0)} 283`;
  document
    .getElementById("base-timer-path-remaining")
    .setAttribute("stroke-dasharray", circleDasharray);
}

</script>
<button disabled={!timeUp}  on:click="{() => dispatch('solution', '')}"><span>{text}</span>
<div class="clock-container">
    <div class="base-timer">
        <svg class="base-timer__svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g class="base-timer__circle">
            <circle class="base-timer__path-elapsed" cx="50" cy="50" r="45"></circle>
            <path
            id="base-timer-path-remaining"
            stroke-dasharray="283"
            class="base-timer__path-remaining"
            class:red class:orange class:green
            d="
                M 50, 50
                m -45, 0
                a 45,45 0 1,0 90,0
                a 45,45 0 1,0 -90,0
            "
            ></path>
        </g>
        </svg>
        <span id="base-timer-label" class="base-timer__label">
            {formatTime(timeLeft)}
        </span>
    </div>
</div>
</button>
<style>

button{
    display: flex;
    justify-content:  space-evenly ;
    align-items: center;
    padding: 5px;
    display: inline-block;
    display: flex;
}

span{
    padding-right: 10px;
    
}

.clock-container{
  width: 30px;
  height: 30px;
}

.base-timer {
  position: relative;
  width: 100px;
  height: 100px;
  line-height: 100px;
  display: flex;
  align-items: center;
  transform: scale(0.3);
  transform-origin: left top;
}

.base-timer__svg {
  transform: scaleX(-1);
}

.base-timer__circle {
  fill: none;
  stroke: none;
}

.base-timer__path-elapsed {
  stroke-width: 10px;
  stroke: grey;
}

.base-timer__path-remaining {
  stroke-width: 10px;
  stroke-linecap: round;
  transform: rotate(90deg);
  transform-origin: center;
  transition: 1s linear all;
  fill-rule: nonzero;
  stroke: currentColor;
}

.base-timer__path-remaining.green {
  color: rgb(65, 184, 131);
}

.base-timer__path-remaining.orange {
  color: orange;
}

.base-timer__path-remaining.red {
  color: red;
}

.base-timer__label {
  position: absolute;
  width: 100px;
  height: 100px;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 35px;
  vertical-align: middle;
  transform: translateY(-2px);


}

  </style>