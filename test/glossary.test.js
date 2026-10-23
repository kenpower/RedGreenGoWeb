import { GLOSSARY, glossaryFor } from "../src/content/glossary.js";

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
      "Poor name", "Magic number", "Duplicated code", "Long or tangled method", "Primitive obsession",
    ])
      expect(glossaryFor(name)).not.toBeNull();
  });

  test("a smell and its refactoring stay apart", () => {
    expect(glossaryFor("Magic number")).not.toBe(glossaryFor("Replace Magic Number with Constant"));
  });

  test("unknown or empty names give null", () => {
    expect(glossaryFor("Reticulate Splines")).toBeNull();
    expect(glossaryFor("")).toBeNull();
    expect(glossaryFor(undefined)).toBeNull();
  });
});
