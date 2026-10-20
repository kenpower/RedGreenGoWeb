// A step-by-step guide for novices, shown in the first two cycles: numbered
// steps for the phase, ticked live from the helper's data. From cycle 3 the
// pair knows the routine and gets only the compact live lines.
//
// Each item is {text, why?, done}: done true = ticked, false = not right
// (e.g. the tests changed in Green), null = not known yet or nothing to tick.
import { pickRedTest, changedSinceRun, buildFailed } from "./rules.js";

export const GUIDE_CYCLES = 2;

const results = (snapshot) => Object.fromEntries((snapshot?.tests || []).map((t) => [t.name, t.status]));
const testFiles = (snapshot) =>
  (snapshot?.files || [])
    .filter((f) => f.kind === "test")
    .map((f) => `${f.path}\n${f.content}`)
    .sort()
    .join("\n");

function redGuide(before, now, live) {
  const pick = now && before ? pickRedTest(before, now) : null;
  const written = !!pick && pick.problem?.rule !== "no_new_test";
  const name = pick?.name;
  const ran = written && !changedSinceRun(now) && (buildFailed(now) || (name && name in results(now)));
  const failing = live?.lines?.[0]?.ok;
  return [
    {
      text: "In your test file, write ONE TEST(...) that calls a function that doesn't exist yet, named after what it should do",
      done: now ? written : null,
    },
    { text: "Run all tests: Test → Run All Tests (Ctrl+R, A)", done: written ? ran : null },
    {
      text: "Check it fails. 'Doesn't compile' counts, because the function doesn't exist yet",
      why: "The failing test proves it really checks something.",
      done: ran ? failing === true : null,
    },
    { text: "Click Done", done: null },
  ];
}

function greenGuide(before, now, live) {
  const focus = live?.focusTest;
  const ran = results(now);
  const testsChanged = !!(before && now && testFiles(before) !== testFiles(now));
  return [
    {
      text: `Write the least code that makes ${focus || "the failing test"} pass. Returning the exact expected value is allowed`,
      why: "The next test will force a real solution.",
      done: focus && now && !buildFailed(now) && !changedSinceRun(now) && focus in ran ? ran[focus] === "passed" : null,
    },
    { text: "Don't change the tests in this step", done: now ? !testsChanged : null },
    { text: "Run all tests and see everything green", done: live ? (live.goalMet ? true : null) : null },
    { text: "Click Done", done: null },
  ];
}

function refactorGuide(before, now, live) {
  const allGreen = live?.lines?.length ? live.lines.every((l) => l.ok === true) : null;
  const broken = live?.lines?.some((l) => l.ok === false);
  return [
    { text: "Look for duplication or unclear names, in the code AND the tests", done: null },
    { text: "Changing nothing is fine this early", done: null },
    { text: "Run the tests: still green?", done: live ? (allGreen ? true : broken ? false : null) : null },
    { text: "Click Done, then commit", done: null },
  ];
}

const SWAP_WHY = "One of you writes the test, the other makes it pass: you both learn both halves.";

// The guide for this step, or [] from cycle 3 (and for Swap after cycle 1).
// `live` is rules.liveStatus for the step; `now` the helper snapshot or null.
export function guideFor(phase, cycle, before, now, live) {
  if (cycle > GUIDE_CYCLES) return [];
  switch (phase) {
    case "red":
      return redGuide(before, now, live);
    case "green":
      return greenGuide(before, now, live);
    case "refactor":
      return refactorGuide(before, now, live);
    case "swap":
      return cycle === 1 ? [{ text: "Hand over the keyboard: the navigator drives now", why: SWAP_WHY, done: null }] : [];
    default:
      return [];
  }
}
