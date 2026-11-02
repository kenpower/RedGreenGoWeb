// "How?" for Visual Studio 2022 actions: a fixed, short answer for the students
// who know WHAT the card asks but not HOW to do it. All default key bindings
// (Visual Studio 2022, C++), then VS Code's, CLion's and the command line's
// (OTHER_IDES). Never generated, never from the coach.
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

// The same answers for the other IDEs (ide.js); a kind not listed falls back to Visual Studio's.
const OTHER_IDES = {
  vscode: {
    run_tests: "Open the Testing view (the flask icon in the left bar) and click Run Tests. The results appear there.",
    build: "Click Build in the status bar, or press F7. Compile errors appear in the Problems panel (Ctrl+Shift+M).",
    commit: "Open Source Control (Ctrl+Shift+G). Type a message in the box, then click Commit (yes to staging all changes).",
    undo: "Open Source Control (Ctrl+Shift+G), hover over the changed file and click Discard Changes. To undo just your last edit, press Ctrl+Z in the editor.",
    rename: "Click on the name, press F2, type the new name and press Enter.",
    extract: "Select the lines, press Ctrl+. (Quick Fix) and choose Extract to function, or right-click > Refactor.",
    comment_out: "Select the lines and press Ctrl+/. Press it again to bring them back.",
  },
  clion: {
    run_tests: "Choose All CTest in the run configuration list (top right) and click Run (Shift+F10). The results appear in the Run window.",
    build: "Build > Build Project (Ctrl+F9). Compile errors appear in the Build window.",
    commit: "Open the Commit tool window (Alt+0). Tick the changed files, type a message, then click Commit.",
    undo: "Open the Commit tool window (Alt+0), right-click the changed file and choose Rollback. To undo just your last edit, press Ctrl+Z in the editor.",
    rename: "Click on the name, press Shift+F6, type the new name and press Enter.",
    extract: "Select the lines and press Ctrl+Alt+M (Refactor > Extract Method).",
    comment_out: "Select the lines and press Ctrl+/. Press it again to bring them back.",
    goto_definition: "Click on the name and press Ctrl+B.",
  },
  commandline: {
    run_tests: "cmake --build build, then ctest --test-dir build --output-on-failure.",
    build: "cmake --build build. Compile errors appear in the terminal.",
    commit: 'git add -A, then git commit -m "your message".',
    undo: "git restore . throws away every change since the last commit; git restore <file> just that file.",
    rename: "Use your editor's Rename command, so every use changes, not find-and-replace.",
    extract: "Use your editor's Extract Function command, or cut the lines into a new function by hand.",
  },
};

// The how-to for an item ({howto?, id?}) in `ide` (ide.js; default Visual Studio), or null.
export function howtoFor(item, ide) {
  const kind = item?.howto || STEP_HOWTO[item?.id];
  if (!HOWTO[kind]) return null;
  const steps = OTHER_IDES[ide]?.[kind];
  return { kind, ...HOWTO[kind], ...(steps ? { steps } : {}) };
}
