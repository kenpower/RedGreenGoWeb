// The refactor lab (DESIGN-refactor-lab.md B): a pair gets messy code with
// complete passing tests and applies the refactorings from the lecture, one
// at a time:  [REFACTOR] ---> [TEST] ---> [COMMIT] --↺  (swap roles after each commit).
// The starter project's README chooses it:
//   Lab: refactor
//   Refactorings: Extract Function, Rename Variable, Replace Magic Number with Constant
// Everything here is the app's own rules: the lab works without the coach.
import { testChanges, buildFailed, staleResults, failingTests, currentTests, uncommittedFiles } from "./rules.js";

export const LAB_PHASES = ["refactor", "test", "commit"];
// when the README lists none
export const DEFAULT_REFACTORINGS = [
  "Extract Function",
  "Rename Variable",
  "Replace Magic Number with Constant",
  "Decompose Conditional",
];
const LAB_LINE = /^\s*lab\s*:\s*refactor(?:ing)?\s*$/im;
const REFACTORINGS_LINE = /^\s*refactorings\s*:\s*(.+)$/im;
const MAX_REFACTORINGS = 20;

// {refactorings: [names]} when the README chooses the lab, else null.
export function parseLab(readme) {
  const text = String(readme || "");
  if (!LAB_LINE.test(text)) return null;
  const listed = (text.match(REFACTORINGS_LINE)?.[1] || "")
    .split(/[,;]/)
    .map((name) => name.trim().replace(/\.$/, "").slice(0, 60))
    .filter(Boolean);
  return { refactorings: (listed.length ? [...new Set(listed)] : DEFAULT_REFACTORINGS).slice(0, MAX_REFACTORINGS) };
}

// The production code, to tell whether it changed since the round began.
const productionCode = (snapshot) =>
  (snapshot?.files || [])
    .filter((f) => f.kind === "production")
    .map((f) => `${f.path}\n${f.content}`)
    .join("\n");

const testsUnchanged = (base, now) => {
  const c = testChanges(base, now);
  return !c.added.length && !c.removed.length && !c.changed.length;
};

// The live lines for a lab phase, against `base` (the code at the last commit,
// or at the start): [{text, ok}] (ok true met, false a problem, null not yet),
// and goalMet when Done may be clicked.
export function labStatus(phase, base, now) {
  if (!now) return null;
  const lines = [];
  const unchanged = testsUnchanged(base, now);
  const testsLine = unchanged
    ? { text: "Tests unchanged ✓", ok: true }
    : { text: "You changed the tests: put them back, the lab only changes production code", ok: false };
  if (phase === "refactor") {
    lines.push(
      productionCode(now) !== productionCode(base)
        ? { text: "One refactoring made in the production code ✓", ok: true }
        : { text: "Make one refactoring in the production code", ok: null }
    );
    lines.push(testsLine);
  } else if (phase === "test") {
    lines.push(testsLine);
    if (buildFailed(now)) lines.push({ text: "The code doesn't build: fix it, or undo the last change", ok: false });
    else if (staleResults(now) || !currentTests(now).length) lines.push({ text: "Run all the tests (Ctrl+R, A)", ok: null });
    else if (failingTests(now).length)
      lines.push({ text: `${failingTests(now).join(", ")} fails: undo the last change, then run the tests again`, ok: false });
    else lines.push({ text: "Every test passes on a fresh run ✓", ok: true });
  } else if (phase === "commit") {
    const git = now.git;
    if (!git?.repo) lines.push({ text: "No git repository, so the commit can't be checked: commit if you can", ok: true });
    else {
      const moved = !!git.head && git.head !== base?.git?.head;
      lines.push(moved ? { text: "Committed ✓", ok: true } : { text: "Commit, with a message that names the refactoring", ok: null });
      const dirty = uncommittedFiles(now);
      lines.push(
        dirty.length
          ? { text: `Not committed yet: ${dirty.slice(0, 3).join(", ")}${dirty.length > 3 ? "…" : ""}`, ok: moved ? false : null }
          : { text: "Nothing left uncommitted ✓", ok: true }
      );
    }
  }
  return { lines, goalMet: lines.length > 0 && lines.every((l) => l.ok === true) };
}

// What each lab phase's card says when nothing more specific applies.
export const LAB_CARDS = {
  refactor: {
    title: "Refactor",
    driver: "Pick one smell and apply one refactoring from the list. Change only the production code.",
    navigator: "Name the refactoring you're doing, and stop the driver from doing a second one.",
    done: "Done: one refactoring made",
  },
  test: {
    title: "Test",
    driver: "Build and run all the tests (Ctrl+R, A).",
    navigator: "Check every test is still green. If one fails, say: undo the last change.",
    done: "Done: every test passes",
  },
  commit: {
    title: "Commit",
    driver: "Commit, with a message that names the refactoring (e.g. 'Extract Function: priceFor').",
    navigator: "Check nothing else slipped into the commit. Then you swap roles.",
    done: "Done: committed",
  },
};
