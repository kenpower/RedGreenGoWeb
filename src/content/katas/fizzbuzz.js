// FizzBuzz kata pack, used as a guide for the coach rather than a script.
// Students may cover behaviours in any order that respects `requires`;
// `teacherRoute` is the suggested order and matches the <article id="loopN">
// solutions in public/content/fizzbuzz.html (each article lists its
// behaviours in data-behaviours).
// Engine-wide TDD rules (one new test per Red, Red before Green, no new
// behaviour in Refactor, tests must assert) live in the engine, not here.
export const fizzbuzz = {
  id: "fizzbuzz",
  title: "FizzBuzz",
  functionName: "fizzBuzz",
  signature: "std::string fizzBuzz(int number)",
  solutionsUrl: "content/fizzbuzz.html",

  behaviours: [
    {
      id: "callable",
      hint: "Can a test even call a fizzBuzz function? A test that doesn't compile counts as failing.",
      requires: [],
      why: "The smallest possible red: the compiler tells you what to build.",
      check: { calls: "fizzBuzz" },
    },
    {
      id: "returns_string",
      hint: "Check that fizzBuzz gives back text, without caring what the text says.",
      requires: ["callable"],
      why: "Pins the return type before any values, so Green can be just `return \"\"`.",
      alternatives: [
        "Skipping this and going straight to normal_one is fine; the EXPECT_EQ forces the type anyway.",
      ],
      optional: true,
    },
    {
      id: "normal_one",
      hint: "What should fizzBuzz return for the simplest 'normal' number?",
      requires: ["callable"],
      why: "First real value. Green should be a hard-coded return.",
      alternatives: ["Any number that isn't a multiple of 3 or 5 is fine as the first value."],
      badMoves: [
        "Using std::to_string on this first Green: with only one example, hard-code it.",
      ],
      check: { expects: "\"1\"", args: [1] },
    },
    {
      id: "normal_more",
      hint: "Pick another 'normal' number (not a multiple of 3 or 5) that your code doesn't handle yet.",
      requires: ["normal_one"],
      why: "Triangulation: a second and third example force the general std::to_string solution in Refactor.",
      alternatives: [
        "Green for the second example may hard-code it with an if; that is the intended move, and the general solution comes in Refactor once there are three examples.",
        "Going straight to the general solution on the second or third example is also fine.",
      ],
      badMoves: ["Jumping to 3 while normal numbers are still hard-coded."],
      check: { args: [2, 4, 7, 8, 11] },
    },
    {
      id: "normal_general",
      hint: "Normal numbers look done. Are you sure about bigger ones, like two or three digits?",
      requires: ["normal_more"],
      why: "A confidence test (11, 101). It should pass straight away, which then pushes the pair on to special numbers.",
      optional: true,
      // Suspends the engine's "a new test must fail first" rule for this behaviour only.
      allowPassingRed: true,
    },
    {
      id: "fizz_3",
      hint: "Write a test for the first 'special' number.",
      requires: ["normal_more"],
      why: "Normal numbers first, so the special case has to be a real branch on top of working code.",
      alternatives: ["Starting the special numbers with 5 (buzz_5) is equally good."],
      check: { expects: "\"Fizz\"", args: [3] },
    },
    {
      id: "fizz_general",
      hint: "Your code handles one multiple of 3. Does it handle another one?",
      requires: ["fizz_3"],
      why: "Forces `% 3` instead of `== 3`.",
      check: { expects: "\"Fizz\"", args: [6, 9, 12] },
    },
    {
      id: "buzz_5",
      hint: "What is the other kind of special number?",
      requires: ["normal_more"],
      why: "Mirrors fizz_3.",
      check: { expects: "\"Buzz\"", args: [5] },
    },
    {
      id: "buzz_general",
      hint: "Your code handles one multiple of 5. Does it handle another one?",
      requires: ["buzz_5"],
      why: "Mirrors fizz_general. The teacher route skips it because by then the % pattern is obvious.",
      optional: true,
      check: { expects: "\"Buzz\"", args: [10, 20, 25] },
    },
    {
      id: "fizzbuzz_15",
      hint: "Last case: numbers that are multiples of both 3 and 5. What should fizzBuzz return for those?",
      requires: ["fizz_3", "buzz_5"],
      why: "Last, because it only makes sense once both rules exist. It also teaches that the order of the checks matters.",
      badMoves: ["Testing 15 before both 3 and 5 exist: forces two rules in one Green step."],
      check: { expects: "\"FizzBuzz\"", args: [15, 30, 45] },
    },
  ],

  // One entry per loop in the solutions HTML; a loop can cover several
  // behaviours and a behaviour can take several loops.
  teacherRoute: [
    ["callable"],
    ["returns_string"],
    ["normal_one"],
    ["normal_more"],
    ["normal_more"],
    ["normal_general", "fizz_3"],
    ["fizz_general"],
    ["buzz_5"],
    ["fizzbuzz_15"],
  ],

  // Kata-specific judgement for the coach.
  badMoves: [
    "Implementing all of FizzBuzz in the first Green.",
    "Writing the 1-100 printing loop: the kata is the function, not the program.",
    "Several unrelated values (e.g. 3 and 5) in one new test.",
  ],
};
