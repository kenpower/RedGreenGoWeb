import { messGuide } from "../src/mess.js";

const FILES = ["ConnectFour.cpp", "ConnectFour.h", "test.cpp"];

describe("messGuide: back to code that works", () => {
  test("the lab and a Red go back to the last commit, with every changed file", () => {
    for (const [mode, phase] of [["refactor", "test"], ["tdd", "red"]]) {
      const guide = messGuide(mode, phase, FILES);
      expect(guide.title).toMatch(/last commit/);
      expect(guide.steps.join(" ")).toMatch(/Undo Changes/);
      expect(guide.files).toEqual(FILES);
    }
  });

  test("Green undoes only the production code, so the Red test stays", () => {
    const guide = messGuide("tdd", "green", FILES);
    expect(guide.files).toEqual(["ConnectFour.cpp", "ConnectFour.h"]);
    expect(guide.steps.join(" ")).toMatch(/not the test file/);
  });

  test("Refactor never sends them back past this cycle's test", () => {
    const guide = messGuide("tdd", "refactor", FILES);
    expect(guide.steps.join(" ")).toMatch(/Ctrl\+Z/);
    expect(guide.steps.join(" ")).not.toMatch(/Right-click Changes/);
    expect(guide.files).toEqual([]);
  });
});
