import { HOWTO, STEP_HOWTO, howtoFor } from "../src/content/howto.js";
import { STEPS } from "../src/content/steps.js";

describe("Visual Studio how-tos", () => {
  test("every step id and kind in the map exists", () => {
    const ids = new Set(STEPS.map((s) => s.id));
    for (const [id, kind] of Object.entries(STEP_HOWTO)) {
      expect(ids.has(id)).toBe(true);
      expect(HOWTO[kind]).toBeDefined();
    }
  });

  test("an explicit howto key wins over the step id", () => {
    expect(howtoFor({ id: "refactor.commit", howto: "build" }).kind).toBe("build");
  });

  test("a step id finds its how-to", () => {
    const h = howtoFor({ id: "red.run_tests", text: "whatever" });
    expect(h.kind).toBe("run_tests");
    expect(h.steps).toMatch(/Ctrl\+R, A/);
  });

  test("items without one, and unknown kinds, give null", () => {
    expect(howtoFor({ id: "red.add_assertion" })).toBeNull();
    expect(howtoFor({ howto: "nope" })).toBeNull();
    expect(howtoFor(null)).toBeNull();
  });

  test("each how-to is short", () => {
    for (const h of Object.values(HOWTO)) expect(h.steps.length).toBeLessThan(200);
  });
});
