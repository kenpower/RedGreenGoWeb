// Generic TDD hints for the step's hint label, for any problem. Used when the
// coach hasn't suggested a next test. One is picked per cycle, so the pair
// sees a different hint as the game goes on.
export const phaseHints = {
  red: [
    "Aim for the simplest test that will fail against the code as it is now.",
    "Stuck? Write the assertion first: what result do you expect? Then fill in the call above it.",
    "A test that doesn't compile because the function doesn't exist yet counts as failing.",
    "Pick the next example your code gets wrong, but only one. Leave the tricky cases for later.",
    "Not sure what's next? Look for the simplest input your code doesn't handle yet.",
    "Name the test after the behaviour it checks, so a failure tells you what broke.",
  ],
  green: [
    "Write only the code the failing test needs, even if it looks silly.",
    "Hard-coding the expected answer is fine for now. More tests will force the general solution.",
    "Make the test pass without touching the tests.",
    "If it's taking long, the test may be too big. Is there a smaller test to write first?",
    "Run all the tests, not just the new one: the old ones must keep passing too.",
  ],
  refactor: [
    "Look for duplication: code that is repeated, or ifs that could become one general rule.",
    "Are the names clear? Rename anything a reader would have to puzzle over.",
    "Change one small thing, then run the tests again.",
    "The tests can be refactored too, as long as they still check the same things.",
    "Nothing worth changing yet? That's fine: say so and move on.",
  ],
};

export function hintFor(phase, cycle = 1) {
  const hints = phaseHints[phase];
  return hints ? hints[(cycle - 1) % hints.length] : "";
}
