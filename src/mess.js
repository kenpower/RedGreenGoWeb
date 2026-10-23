// "In a mess?": how to get back to code that works, step by step in Visual
// Studio. Only a guide: the helper stays read-only, the pair undoes it
// themselves. Where "back" is depends on the step: the last commit is the
// start of the lab's round, and of a TDD Red (the game asks for a commit
// before each Red), but going back that far from Green or Refactor would
// throw away this cycle's test.

const GIT_CHANGES = "Open Git Changes: View > Git Changes (Ctrl+0, Ctrl+G).";
const RUN = "Build and run all the tests (Ctrl+R, A): you should be back where you started.";
const SAY = "Navigator: say what you were trying to do. You'll try it again in a smaller step.";

// {title, steps: [text], files}: `files` the changed source files to undo (the
// helper's uncommitted list), when they matter for this step.
export function messGuide(mode, phase, uncommitted = []) {
  if (mode === "refactor")
    return {
      title: "Go back to your last commit (the start of this round)",
      steps: [
        SAY,
        GIT_CHANGES,
        "Right-click Changes > Undo Changes, and say yes. Only work since your last commit is lost.",
        RUN,
      ],
      files: uncommitted,
    };
  if (phase === "red")
    return {
      title: "Go back to your last commit (the start of this Red)",
      steps: [SAY, GIT_CHANGES, "Right-click Changes > Undo Changes, and say yes.", RUN],
      files: uncommitted,
    };
  if (phase === "green")
    return {
      title: "Undo your production code, keep your new test",
      steps: [
        SAY,
        GIT_CHANGES,
        "Right-click each production file (not the test file) > Undo Changes.",
        "Build and run all the tests: only your new test should fail, as at the end of Red.",
      ],
      files: uncommitted.filter((f) => !/test/i.test(f.split("/").pop())),
    };
  return {
    title: "Undo your last tidy-up",
    steps: [
      SAY,
      "Press Ctrl+Z in the file you changed, one step at a time, running the tests (Ctrl+R, A) after each, until they all pass.",
      "Still red? Ask your teacher before undoing more: going back to the last commit would also undo this cycle's test.",
    ],
    files: [],
  };
}
