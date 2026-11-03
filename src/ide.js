// The keys and menus the game names, for the IDE the pair works in (the helper's
// `ide`, detect_ide in rgg_server.py). The game's own text is written for Visual
// Studio; tailor() swaps its Visual Studio phrases for the IDE's where it is
// shown (DoNow, the to-do lists, "In a mess?"). Unknown IDE: Visual Studio.

export const IDES = ["visualstudio", "vscode", "clion", "commandline"];
export const DEFAULT_IDE = "visualstudio";
export const ideName = (name) => (IDES.includes(name) ? name : DEFAULT_IDE);

// What each Visual Studio phrase becomes, per IDE.
const PHRASES = {
  vscode: {
    name: "VS Code",
    runAll: "the Testing view → Run Tests",
    runKeys: "the Testing view → Run Tests",
    rename: "F2",
    gitPanel: "Source Control (Ctrl+Shift+G)",
    undoAll: "Hover over Changes and click Discard All Changes",
    undoFile: "> Discard Changes",
    testView: "the Testing view",
    build: "Build in the status bar (F7)",
  },
  clion: {
    name: "CLion",
    runAll: "All CTest → Run (Shift+F10)",
    runKeys: "All CTest, Shift+F10",
    rename: "Shift+F6",
    gitPanel: "the Commit tool window (Alt+0)",
    undoAll: "Right-click Changes > Rollback",
    undoFile: "> Rollback",
    testView: "the Run window",
    build: "Build > Build Project (Ctrl+F9)",
  },
  commandline: {
    name: "the command line",
    // ctest alone runs the test program from the last build: build first, every time
    runAll: "cmake --build build, then ctest --test-dir build",
    runKeys: "cmake --build build, then ctest --test-dir build",
    rename: "your editor's Rename",
    gitPanel: "git status",
    undoAll: "Run git restore . in the terminal",
    undoFile: ": git restore <file>",
    testView: "ctest's output",
    build: "cmake --build build",
  },
};

// Visual Studio's phrase -> PHRASES key, longest first so the whole menu path goes at once.
const VS_PHRASES = [
  ["Test → Run All Tests (Ctrl+R, A)", "runAll"],
  ["Test > Run All Tests (Ctrl+R, A)", "runAll"],
  ["Test → Run All Tests, Ctrl+R, A", "runAll"],
  ["Test → Run All Tests", "runAll"],
  ["Test > Run All Tests", "runAll"],
  ["Ctrl+R, A", "runKeys"],
  ["Ctrl+R, Ctrl+R", "rename"],
  ["Ctrl+R then Ctrl+R", "rename"],
  ["View > Git Changes (Ctrl+0, Ctrl+G)", "gitPanel"],
  ["Git Changes (Ctrl+0, Ctrl+G)", "gitPanel"],
  ["Right-click Changes > Undo Changes", "undoAll"],
  ["> Undo Changes", "undoFile"],
  ["Build > Build Solution (Ctrl+Shift+B)", "build"],
  ["Test Explorer", "testView"],
  ["Visual Studio", "name"],
];

// The text with its Visual Studio keys and menus as `ide` has them.
export function tailor(text, ide) {
  const phrases = PHRASES[ideName(ide)];
  if (!phrases || typeof text !== "string") return text;
  return VS_PHRASES.reduce((out, [vs, key]) => out.split(vs).join(phrases[key]), text);
}
