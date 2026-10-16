// One goal per iteration of the FizzBuzz kata, shown on the "Make it Red" step.
// Each goal points at the next behaviour without giving away the test.
// Keep in step with the <article id="loopN"> solutions in public/content/fizzbuzz.html
export const fizzbuzzGoals = [
  "Start at the very beginning: can a test even call a fizzBuzz function? A test that doesn't compile counts as failing.",
  "fizzBuzz should give back some text. Write a test that only checks it returns a string, not what the string says.",
  "Now check an actual answer. What should fizzBuzz return for the simplest 'normal' number?",
  "Pick another 'normal' number (not a multiple of 3 or 5) that your code doesn't handle yet.",
  "One more 'normal' number. Don't jump to 3 yet: get the normal numbers working before any special ones.",
  "Normal numbers look done. Are you sure about bigger ones? Then write a test for the first 'special' number.",
  "Your code handles one multiple of 3. Does it handle another one?",
  "Multiples of 3 are covered. What is the next kind of special number?",
  "Last case: numbers that are multiples of both 3 and 5. What should fizzBuzz return for those?",
];
