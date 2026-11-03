import fs from "fs";
import { tailor, ideName, IDES } from "../src/ide.js";
import { howtoFor, HOWTO } from "../src/content/howto.js";
import { messGuide } from "../src/mess.js";

describe("tailor: Visual Studio's keys and menus, as the pair's IDE has them", () => {
  test("Visual Studio, or an IDE the helper couldn't tell, keeps the text as it is", () => {
    const text = "Run all tests: Test → Run All Tests (Ctrl+R, A)";
    expect(tailor(text, "visualstudio")).toBe(text);
    expect(tailor(text, undefined)).toBe(text);
    expect(ideName("emacs")).toBe("visualstudio");
  });

  test("each IDE's way of running all the tests", () => {
    expect(tailor("Run all tests: Test → Run All Tests (Ctrl+R, A)", "vscode")).toBe("Run all tests: the Testing view → Run Tests");
    expect(tailor("Run all the tests (Ctrl+R, A): every test passes", "clion")).toBe(
      "Run all the tests (All CTest, Shift+F10): every test passes"
    );
    expect(tailor("run all tests (Ctrl+R, A)", "commandline")).toBe(
      "run all tests (cmake --build build, then ctest --test-dir build)"
    );
  });

  test("renaming, Git and undoing", () => {
    expect(tailor("press Ctrl+R, Ctrl+R to rename", "clion")).toBe("press Shift+F6 to rename");
    expect(tailor("Open View > Git Changes (Ctrl+0, Ctrl+G).", "vscode")).toBe("Open Source Control (Ctrl+Shift+G).");
    expect(tailor("Right-click Changes > Undo Changes, and say yes.", "clion")).toBe("Right-click Changes > Rollback, and say yes.");
    expect(tailor("Right-click each production file (not the test file) > Undo Changes.", "vscode")).toBe(
      "Right-click each production file (not the test file) > Discard Changes."
    );
  });

  test("text that isn't a string passes through", () => {
    expect(tailor(null, "vscode")).toBeNull();
    expect(tailor("", "vscode")).toBe("");
  });

  // The strings the game shows students, from the files that hold them. Every
  // Visual Studio phrase among them must have a tailored version.
  const VS_ONLY = /Ctrl\+R|Ctrl\+0|Git Changes|Test Explorer|Run All Tests|Visual Studio|Undo Changes|Build Solution/;
  const SHOWN = ["src/lab.js", "src/guide.js", "src/content/steps.js", "src/rules.js", "src/mess.js",
    "src/components/Step.svelte", "src/components/LabGame.svelte", "src/App.svelte"];
  const literals = (path) =>
    fs
      .readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
      .match(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || [];

  test.each(IDES.filter((i) => i !== "visualstudio"))("no Visual Studio phrase is left for %s", (ide) => {
    const shown = SHOWN.flatMap(literals).filter((s) => VS_ONLY.test(s));
    expect(shown.length).toBeGreaterThan(5); // the scan finds them
    expect(shown.map((s) => tailor(s, ide)).filter((s) => VS_ONLY.test(s))).toEqual([]);
    for (const phase of ["red", "green", "refactor"])
      for (const step of messGuide(phase === "refactor" ? "refactor" : "tdd", phase).steps)
        expect(tailor(step, ide)).not.toMatch(VS_ONLY);
  });
});

describe("howtoFor: the How? answer in the pair's IDE", () => {
  test("each IDE has its own keys; a kind it doesn't list falls back to Visual Studio's", () => {
    expect(howtoFor({ howto: "rename" }).steps).toMatch(/Ctrl\+R then Ctrl\+R/);
    expect(howtoFor({ howto: "rename" }, "clion").steps).toMatch(/Shift\+F6/);
    expect(howtoFor({ howto: "run_tests" }, "vscode").steps).toMatch(/Testing view/);
    expect(howtoFor({ howto: "undo" }, "commandline").steps).toMatch(/git restore/);
    expect(howtoFor({ howto: "goto_definition" }, "vscode").steps).toBe(HOWTO.goto_definition.steps);
    expect(howtoFor({ howto: "run_tests" }, "vscode").title).toBe("Run all tests");
  });

  test("no answer for another IDE names Visual Studio's keys", () => {
    for (const ide of ["vscode", "clion", "commandline"])
      for (const kind of Object.keys(HOWTO)) expect(howtoFor({ howto: kind }, ide).steps).not.toMatch(/Ctrl\+R|Git Changes/);
  });
});
