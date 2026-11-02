import { GLOSSARY, glossaryFor, canonicalRefactoring, refactoringInMessage } from "../src/content/glossary.js";

describe("refactoring glossary", () => {
  test("every entry has a line and a tiny before/after", () => {
    for (const e of GLOSSARY) {
      expect(e.names.length).toBeGreaterThan(0);
      expect(e.line.length).toBeGreaterThan(10);
      for (const code of [e.before, e.after]) {
        expect(code).toBeTruthy();
        expect(code.split("\n").length).toBeLessThanOrEqual(4);
      }
    }
  });

  test("names are matched forgivingly", () => {
    const extract = glossaryFor("Extract Function");
    expect(glossaryFor("extract method")).toBe(extract);
    expect(glossaryFor("  EXTRACT  FUNCTION ")).toBe(extract);
    expect(glossaryFor("Extract Function: priceFor")).toBe(extract);
    const magic = glossaryFor("Replace Magic Number with Constant");
    expect(magic).not.toBeNull();
    expect(glossaryFor("Replace Magic Number with Symbolic Constant")).toBe(magic);
    expect(glossaryFor("Replace Magic Number with (Symbolic) Constant")).toBe(magic);
    expect(glossaryFor("Rename Method")).toBe(glossaryFor("Rename Function"));
    expect(glossaryFor("Rename Variable")).toBe(glossaryFor("rename function"));
  });

  test("the common refactorings and smells are all there", () => {
    for (const name of [
      "Rename Variable", "Rename Function", "Extract Function", "Replace Magic Number with Constant", "Decompose Conditional",
      "Split Loop", "Inline Variable", "Inline Function", "Introduce Explaining Variable",
      "Consolidate Duplicate Conditional Fragments", "Replace Loop with Algorithm",
      "Merge Loops", "Replace Primitive with Object", "Replace Nested Conditional with Guard Clauses",
      "Poor name", "Magic number", "Duplicated code", "Long or tangled method", "Primitive obsession",
    ])
      expect(glossaryFor(name)).not.toBeNull();
  });

  test("a smell and its refactoring stay apart", () => {
    expect(glossaryFor("Magic number")).not.toBe(glossaryFor("Replace Magic Number with Constant"));
  });

  test("one spelling per refactoring: the lab's, else the glossary's, else as given", () => {
    const lab = ["Extract Function", "Replace Magic Number with Constant"];
    expect(canonicalRefactoring("extract method", lab)).toBe("Extract Function");
    expect(canonicalRefactoring("Replace Magic Number with Symbolic Constant: Columns", lab)).toBe(
      "Replace Magic Number with Constant"
    );
    expect(canonicalRefactoring("split loop")).toBe("Split Loop");
    expect(canonicalRefactoring("Rename Function")).not.toBe(canonicalRefactoring("Rename Variable"));
    expect(canonicalRefactoring("Simplify  Expression: winner")).toBe("Simplify Expression");
    expect(canonicalRefactoring("")).toBe("");
  });

  test("the refactoring a commit message names", () => {
    const lab = ["Rename Function", "Merge Loops"];
    expect(refactoringInMessage("Merge Loops: the two loops in bestMoveFor", lab)).toBe("Merge Loops");
    expect(refactoringInMessage("rename function move to bestMoveFor", lab)).toBe("Rename Function");
    expect(refactoringInMessage("Extract Method indexOf\n\nlonger text")).toBe("Extract Function");
    expect(refactoringInMessage("Rename move to bestMoveFor", lab)).toBe("");
    expect(refactoringInMessage("Rename move to bestMoveFor", lab, { loose: true })).toBe("Rename");
    expect(refactoringInMessage("tidy up", lab)).toBe("");
    expect(refactoringInMessage(undefined)).toBe("");
  });

  test("unknown or empty names give null", () => {
    expect(glossaryFor("Reticulate Splines")).toBeNull();
    expect(glossaryFor("")).toBeNull();
    expect(glossaryFor(undefined)).toBeNull();
  });
});
