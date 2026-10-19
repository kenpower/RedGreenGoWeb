// Hints for the FizzBuzz kata, one per behaviour and phase, shown by the
// step's hint label once the pair has been on a step for a while.
// They go one step further than the goal on the Red step, without writing
// the code for the pair. Keyed by the behaviour ids in katas/fizzbuzz.js.
export const fizzbuzzHints = {
  callable: {
    red: "The test needs one line: call fizzBuzz(1). It won't compile yet, and that counts as red.",
    green: "Declare a fizzBuzz function that takes an int and does nothing. It doesn't need to return anything yet.",
    refactor: "Two or three lines of code rarely need refactoring. Check the test name says what it checks, then move on.",
  },
  returns_string: {
    red: "Store the result of fizzBuzz(1) in a std::string. The build fails while fizzBuzz returns void.",
    green: "Change the return type to std::string and return an empty string. That's all the test asks for.",
    refactor: "Still very little code. Is there anything a reader would trip over? If not, move on.",
  },
  normal_one: {
    red: "Use EXPECT_EQ to compare fizzBuzz(1) with \"1\". The expected value goes first.",
    green: "Return \"1\". Hard-coding feels wrong, but one example doesn't justify anything more.",
    refactor: "A hard-coded \"1\" is fine for now. Wait for more tests to show you the pattern.",
  },
  normal_more: {
    red: "Try 2, then 4. Skip 3: it's a special number, and the normal numbers should work first.",
    green: "An if that returns the new value is enough. The general solution can wait for Refactor.",
    refactor: "Several ifs that each turn a number into its text? With three examples, std::to_string(number) can replace them all.",
  },
  normal_general: {
    red: "Test 11 or 101. This test may pass straight away, which is fine here: it's a confidence check.",
    green: "If the test already passes, there is nothing to write. Move on.",
    refactor: "Do the test names still describe what each test checks?",
  },
  fizz_3: {
    red: "Expect fizzBuzz(3) to return \"Fizz\".",
    green: "Check for number == 3 before the std::to_string line. Don't reach for % yet.",
    refactor: "Is \"Fizz\" clear on its own, or would a named constant help? Either is fine.",
  },
  fizz_general: {
    red: "Try 6. With number == 3 in the code, it should fail.",
    green: "Adding number == 6 to the condition is enough to pass.",
    refactor: "Where is that list of comparisons heading? What do 3, 6, 9 and 12 have in common? Think %.",
  },
  buzz_5: {
    red: "Expect fizzBuzz(5) to return \"Buzz\".",
    green: "Mirror what you did for Fizz. You know the % pattern now, so number % 5 == 0 is fine.",
    refactor: "The Fizz and Buzz checks look alike. Is the code still easy to read?",
  },
  buzz_general: {
    red: "Try 10. Does your Buzz check handle it?",
    green: "If you used number == 5, add 10 to the condition, or switch to %.",
    refactor: "Replace a list of comparisons with % 5 if it is still there.",
  },
  fizzbuzz_15: {
    red: "Expect fizzBuzz(15) to return \"FizzBuzz\".",
    green: "Order matters: which check has to come first so that 15 doesn't stop at Fizz?",
    refactor: "Last chance to tidy up: names, constants and the order of the checks. Do all the tests still pass?",
  },
};

// Used when no behaviour is known for the step.
export const phaseHints = {
  red: "Aim for the simplest test that will fail against the code as it is now. Stuck? Write the assertion first.",
  green: "Write only the code the failing test needs, even if it looks silly. More tests will force the general solution.",
  refactor: "Look for duplication and unclear names. Change one small thing, then run the tests again.",
};
