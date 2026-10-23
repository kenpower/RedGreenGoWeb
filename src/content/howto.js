// "How?" for Visual Studio 2022 actions: a fixed, short answer for the students
// who know WHAT the card asks but not HOW to do it. All default key bindings
// (Visual Studio 2022, C++). Never generated, never from the coach.
//
// An item gets its kind from, first win: an explicit `howto` key on the item
// (guide.js, lab.js, the start card), else its steps.js id (STEP_HOWTO).

export const HOWTO = {
  run_tests: {
    title: "Run all tests",
    steps: "Test > Run All Tests (Ctrl+R, A). The results appear in Test Explorer (Test > Test Explorer).",
  },
  build: {
    title: "Build",
    steps: "Build > Build Solution (Ctrl+Shift+B). Compile errors appear in the Error List (View > Error List).",
  },
  commit: {
    title: "Commit",
    steps: "View > Git Changes (Ctrl+0, Ctrl+G). Type a message in the box, then click Commit All.",
  },
  undo: {
    title: "Undo changes since the last commit",
    steps:
      "Open Git Changes (Ctrl+0, Ctrl+G), right-click the changed file, choose Undo Changes. To undo just your last edit, press Ctrl+Z in the editor.",
  },
  rename: {
    title: "Rename everywhere",
    steps: "Click on the name, press Ctrl+R then Ctrl+R, type the new name and press Enter.",
  },
  extract: {
    title: "Extract a function",
    steps: "Select the lines, press Ctrl+. (Quick Actions) and choose Extract Function, or use Edit > Refactor > Extract Function.",
  },
  comment_out: {
    title: "Comment out lines",
    steps: "Select the lines, press Ctrl+K then Ctrl+C. To bring them back: Ctrl+K then Ctrl+U.",
  },
  goto_definition: {
    title: "Go to a definition",
    steps: "Click on the name and press F12.",
  },
};

// steps.js ids (the TDD checklist) that have a how-to
export const STEP_HOWTO = {
  "red.one_test_only": "comment_out",
  "red.run_tests": "run_tests",
  "red.see_it_fail": "run_tests",
  "red.rename_test": "rename",
  "green.make_it_compile": "build",
  "green.run_tests": "run_tests",
  "green.all_green": "run_tests",
  "refactor.rename": "rename",
  "refactor.rename_tests": "rename",
  "refactor.extract_function": "extract",
  "refactor.undo": "undo",
  "refactor.run_tests": "run_tests",
  "refactor.still_green": "run_tests",
  "refactor.commit": "commit",
};

// The how-to for an item ({howto?, id?}), or null.
export function howtoFor(item) {
  const kind = item?.howto || STEP_HOWTO[item?.id];
  return HOWTO[kind] ? { kind, ...HOWTO[kind] } : null;
}
