import { lockReason } from "../src/lock.js";

const ticked = (text) => ({ text, done: true });

describe("why Done is locked: never empty", () => {
  test("the current checklist item, when there is one", () => {
    const items = [ticked("Write one test"), { text: "Run the tests", short: "Run", done: null, current: true }];
    expect(lockReason({ items })).toBe('see "Run" above');
    expect(lockReason({ items: [{ text: "Run the tests", done: false, current: true }] })).toBe('see "Run the tests" above');
  });

  test("every visible item ticked: the hidden live rule that still holds Done", () => {
    const items = [ticked("Write one test"), ticked("See it fail")];
    const liveLines = [
      { text: "New test Rect.Two: failing ✓", ok: true },
      { text: "You've changed the code since the last run: run the tests", ok: null },
    ];
    expect(lockReason({ items, liveLines })).toBe("You've changed the code since the last run: run the tests");
  });

  test("nothing unmet anywhere and still locked: say to run the tests, never nothing", () => {
    expect(lockReason({ items: [ticked("A")], liveLines: [{ text: "ok", ok: true }] })).toBe(
      "run your tests so the game can check this step"
    );
    expect(lockReason({})).toBe("run your tests so the game can check this step");
  });

  test("no helper comes first", () => {
    expect(lockReason({ helperMissing: true, items: [{ text: "x", current: true }] })).toBe("waiting for the helper");
  });
});
