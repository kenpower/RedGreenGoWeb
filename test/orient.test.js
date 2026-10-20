import { codeStateText, warningsOf, problemEdit, MAX_PROBLEM_EDIT, CODE_STATE_TEXT } from "../src/orient.js";

describe("codeStateText", () => {
  test("has words for every code_state", () => {
    for (const state of ["empty", "scaffold", "partial", "looks_done"]) {
      expect(codeStateText({ code_state: state })).toBe(CODE_STATE_TEXT[state]);
      expect(CODE_STATE_TEXT[state].length).toBeGreaterThan(0);
    }
  });

  test("is empty for an unknown state or no brief", () => {
    expect(codeStateText({ code_state: "weird" })).toBe("");
    expect(codeStateText(null)).toBe("");
  });
});

describe("warningsOf", () => {
  test("keeps the non-empty warnings, trimmed", () => {
    expect(warningsOf({ warnings: [" Code before any test ", "", "  ", "Uncommitted work"] }))
      .toEqual(["Code before any test", "Uncommitted work"]);
  });

  test("copes with a missing or malformed list", () => {
    expect(warningsOf({})).toEqual([]);
    expect(warningsOf(null)).toEqual([]);
    expect(warningsOf({ warnings: "not a list" })).toEqual([]);
    expect(warningsOf({ warnings: [3, "ok"] })).toEqual(["ok"]);
  });
});

describe("problemEdit", () => {
  test("trims the pair's text", () => {
    expect(problemEdit("  Bowling scores  \n")).toBe("Bowling scores");
  });

  test("an empty edit is nothing to save", () => {
    expect(problemEdit("   ")).toBe("");
    expect(problemEdit(undefined)).toBe("");
  });

  test("is cut to fit the teacher's event detail", () => {
    expect(problemEdit("x".repeat(900))).toHaveLength(MAX_PROBLEM_EDIT);
  });
});
