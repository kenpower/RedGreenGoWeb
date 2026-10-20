// A step-by-step guide for novices, shown in the first two cycles: the steps
// of the phase as a checklist, ticked live from the helper's data. From cycle
// 3 the pair knows the routine and gets only the compact live lines.
//
// Each item is {text, short, why?, done, reason?, current?}:
//   done true = ticked, false = a problem (reason says what), null = not done yet
//   short: a few words naming the item, for "Not yet: see <short>"
//   current: the item to work on now (never "Click Done" while Done is locked)
import {
  pickRedTest, changedSinceRun, buildFailed, callsCode, testBodies, failingTests, untestedFunctions,
  testChanges, testChangeMessage,
} from "./rules.js";

export const GUIDE_CYCLES = 2;

const results = (snapshot) => Object.fromEntries((snapshot?.tests || []).map((t) => [t.name, t.status]));
// Green may touch the test files (an #include for a new header), not the tests themselves.
const greenTestChange = (before, now) => {
  if (!before || !now) return "";
  const changes = testChanges(before, now);
  return testChangeMessage("green", changes);
};
const shortName = (name) => (name || "").split(".").pop();
const RUN_AGAIN = "You've changed the code since the last run: run the tests";

// Where the Red test stands: which test, and the first thing wrong with it.
function redState(before, now) {
  if (!before || !now) return { written: false };
  const pick = pickRedTest(before, now);
  if (pick.problem?.rule === "several_new_tests")
    return { written: true, problem: "several", names: pick.names, reason: `${pick.names.length} new tests: keep one, comment out the others` };
  if (pick.problem) {
    const failing = buildFailed(now) ? [] : failingTests(now);
    return failing.length
      ? { written: false, problem: "unchanged", name: failing[0], reason: `${failing[0]} fails, but it hasn't changed since this Red began: change it, or write a new test` }
      : { written: false, problem: "none" };
  }
  const name = pick.name;
  if (!callsCode(testBodies(now)[name] || ""))
    return { written: true, name, problem: "no_code", reason: "Your test doesn't call any of your code" };
  return { written: true, name };
}

function redGuide(before, now, live) {
  const red = redState(before, now);
  const name = red.name;
  const stale = !!now && changedSinceRun(now);
  const ran = red.written && !stale && (buildFailed(now) || (name && name in results(now)));
  const failingLine = live?.lines?.find((l) => l.ok === false && !/doesn't call any of your code/.test(l.text));
  const passes = ran && !buildFailed(now) && results(now)[name] === "passed";

  const write = { text: "In your test file, write ONE TEST(...) that calls a function that doesn't exist yet, named after what it should do", short: "write the test" };
  if (!now) write.done = null;
  else if (red.reason && red.problem !== "none") Object.assign(write, { done: false, reason: red.reason });
  else write.done = red.written ? true : null; // not written yet isn't a problem, just not done

  const run = { text: "Run all tests: Test → Run All Tests (Ctrl+R, A)", short: "run all tests" };
  run.done = red.written && red.problem !== "several" ? (ran ? true : null) : null;
  if (red.written && !ran) run.reason = stale ? RUN_AGAIN : name ? `${shortName(name)} hasn't run yet` : "";

  const fails = {
    text: "Check it fails. 'Doesn't compile' counts, because the function doesn't exist yet",
    short: "check it fails",
    why: "The failing test proves it really checks something.",
  };
  if (!ran) fails.done = null;
  else if (passes) Object.assign(fails, { done: false, reason: "It passed straight away: it needs to fail first" });
  else if (failingLine) Object.assign(fails, { done: false, reason: failingLine.text });
  else fails.done = true;

  return [write, run, fails, { text: "Click Done", short: "click Done", done: null }];
}

function greenGuide(before, now, live) {
  const focus = live?.focusTest;
  const ran = results(now);
  const testChange = greenTestChange(before, now);
  const stale = !!now && changedSinceRun(now);

  const pass = {
    text: `Write the least code that makes ${focus || "the failing test"} pass. Returning the exact expected value is allowed`,
    short: `make ${shortName(focus) || "it"} pass`,
    why: "The next test will force a real solution.",
  };
  pass.done = focus && now && !buildFailed(now) && !stale && focus in ran ? ran[focus] === "passed" || null : null;

  const keep = { text: "Don't change the tests in this step", short: "leave the tests alone", done: now ? !testChange : null };
  if (testChange) keep.reason = testChange;

  const green = { text: "Run all tests and see everything green", short: "run all tests" };
  const otherFailing = live?.lines?.find((l) => l.ok === false && !l.testsChanged && !/^Make /.test(l.text));
  if (!live) green.done = null;
  else if (live.goalMet) green.done = true;
  else if (stale) Object.assign(green, { done: null, reason: RUN_AGAIN });
  else if (otherFailing) Object.assign(green, { done: false, reason: otherFailing.text });
  else green.done = null;

  return [pass, keep, green, { text: "Click Done", short: "click Done", done: null }];
}

function refactorGuide(before, now, live) {
  const broken = live?.lines?.find((l) => l.ok === false);
  const waiting = live?.lines?.find((l) => l.ok === null);
  const still = { text: "Run the tests: still green?", short: "run the tests" };
  if (!live) still.done = null;
  else if (broken) Object.assign(still, { done: false, reason: broken.text });
  else if (waiting) Object.assign(still, { done: null, reason: waiting.text });
  else still.done = live.lines.length ? true : null;
  return [
    { text: "Look for duplication or unclear names, in the code AND the tests", short: "look for duplication", done: null },
    { text: "Changing nothing is fine this early", short: "", done: null },
    still,
    { text: "Click Done, then commit", short: "click Done", done: null },
  ];
}

const SWAP_WHY = "One of you writes the test, the other makes it pass: you both learn both halves.";

// Which item to work on: the first problem; else the first not done (skipping
// advice-only items); "Click Done" only once Done is unlocked.
function markCurrent(items, locked) {
  const last = items.length - 1;
  let i = items.findIndex((item) => item.done === false);
  if (i < 0) i = items.findIndex((item, k) => k < last && item.done === null && isStep(item));
  if (i < 0 && !locked) i = last;
  if (i >= 0) items[i] = { ...items[i], current: true };
  return items;
}
// the Refactor's advice items ("Look for…", "Changing nothing…") aren't steps you tick
const isStep = (item) => !/^Look for|^Changing nothing/.test(item.text);

// The guide for this step, or [] from cycle 3 (and for Swap after cycle 1).
// `live` is rules.liveStatus for the step; `now` the helper snapshot or null;
// `locked` whether Done is locked (then "Click Done" is never the current item).
export function guideFor(phase, cycle, before, now, live, { locked = false } = {}) {
  if (cycle > GUIDE_CYCLES) return [];
  switch (phase) {
    case "red":
      return markCurrent(redGuide(before, now, live), locked);
    case "green":
      return markCurrent(greenGuide(before, now, live), locked);
    case "refactor":
      return markCurrent(refactorGuide(before, now, live), locked);
    case "swap":
      return cycle === 1 ? [{ text: "Hand over the keyboard: the navigator drives now", why: SWAP_WHY, done: null }] : [];
    default:
      return [];
  }
}

const RUN_ACTION = {
  driver: "Run all tests: Test → Run All Tests (Ctrl+R, A).",
  navigator: "Watch the results come in, and say whether they're what you expected.",
};

// While Done is locked (or the rules hold the step): the one action that
// unlocks it, for the driver, and how the navigator supports it. Null when
// nothing specific is wrong (the step's own instructions then apply).
// Green and Refactor end only on a fresh, passing run.
const RERUN_ACTION = {
  driver: "Run all tests (Test → Run All Tests, Ctrl+R, A).",
  navigator: "Check every test is green before moving on.",
};

export function unlockAction(phase, before, now, live) {
  if (!now || !live || live.goalMet) return null;
  if (changedSinceRun(now)) return phase === "red" ? RUN_ACTION : RERUN_ACTION;

  if (phase === "red") {
    const red = redState(before, now);
    if (red.problem === "no_code") {
      const fn = untestedFunctions(now)[0];
      return {
        driver: `Change ${shortName(red.name)} so it calls the function you're about to write${fn ? `, e.g. ${fn}` : ""}.`,
        navigator: "Check the test calls your code, not just true/false.",
      };
    }
    if (red.problem === "several")
      return { driver: "Comment out all but one of the new tests.", navigator: "Agree which one is the smallest next step." };
    if (red.problem === "unchanged")
      return {
        driver: `Change ${shortName(red.name)}, or write a new test, so this Red has its own failing test.`,
        navigator: "Say which behaviour this Red's test should check.",
      };
    if (red.problem === "none")
      return {
        driver: "Write one test that calls a function that doesn't exist yet, named after what it should do.",
        navigator: "Say what the test should check before the driver types.",
      };
    if (!(buildFailed(now) || red.name in results(now))) return RUN_ACTION;
    if (results(now)[red.name] === "passed")
      return {
        driver: `Change ${shortName(red.name)} so it checks something your code doesn't do yet.`,
        navigator: "Check the test fails for the reason you expect.",
      };
    const broken = failingTests(now).find((t) => t !== red.name);
    if (broken)
      return { driver: `Make ${shortName(broken)} pass again, or comment it out.`, navigator: "Check only this Red's test is failing." };
    return null;
  }

  const failing = buildFailed(now) ? [] : failingTests(now);
  const changedTests = live.lines.some((l) => l.testsChanged);
  const changes = changedTests ? testChanges(before, now) : null;
  if (phase === "green") {
    if (changes) {
      const navigator = "Check only production code changes in Green (an #include line is fine).";
      if (changes.changed.length) return { driver: `Undo your changes to ${shortName(changes.changed[0])}.`, navigator };
      if (changes.added.length) return { driver: `Remove ${shortName(changes.added[0])} for now: it belongs in the next Red.`, navigator };
      if (changes.removed.length) return { driver: `Put ${shortName(changes.removed[0])} back.`, navigator };
    }
    const target = live.focusTest || failing[0];
    if (buildFailed(now) || failing.length || target)
      return {
        driver: `Make ${shortName(target) || "the failing test"} pass with the smallest change.`,
        navigator: "Watch for code the test doesn't need.",
      };
    if (live.lines.some((l) => l.ok === null)) return RUN_ACTION;
    return null;
  }
  if (phase === "refactor") {
    if (changes?.removed.length) return { driver: `Put ${shortName(changes.removed[0])} back.`, navigator: "Check the same tests still run." };
    if (changes?.added.length)
      return { driver: `Remove ${shortName(changes.added[0])} for now: it belongs in the next Red.`, navigator: "Check the same tests still run." };
    if (buildFailed(now) || failing.length)
      return { driver: "Undo the last change so all tests pass again.", navigator: "Suggest a smaller change to try next." };
    if (live.lines.some((l) => l.ok === null)) return RUN_ACTION;
  }
  return null;
}
