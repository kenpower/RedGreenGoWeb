// The refactor lab (DESIGN-refactor-lab.md B): a pair gets messy code with
// complete passing tests and applies the refactorings from the lecture, one
// at a time:  [REFACTOR] ---> [TEST] ---> [COMMIT] --↺  (swap roles after each commit).
// The starter project's README chooses it:
//   Lab: refactor
//   Refactorings: Extract Function, Rename Variable, Replace Magic Number with Constant
// Everything here is the app's own rules: the lab works without the coach.
import { testChanges, testBodies, buildFailed, staleResults, failingTests, currentTests, uncommittedFiles } from "./rules.js";

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

// A test edit that only follows the production code is still the same test:
// a renamed name (Ctrl+R, Ctrl+R renames in test.cpp too), or a literal
// replaced by a new constant with that value (`-1` → `ConnectFour::NoMove`).
const TOKEN = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[A-Za-z_]\w*|\d[\w.]*|::|\S/g;
const tokens = (text) => text.match(TOKEN) || [];
const NAME = /^[A-Za-z_]\w*$/;
const LITERAL = /^(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\d[\w.]*)$/;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// [{was: [tokens], is: [tokens]}]: the runs of tokens that differ, from an LCS (test bodies are short).
function hunks(a, b) {
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0, j = 0, hunk = null;
  const flush = () => hunk && (out.push(hunk), (hunk = null));
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      i++, j++;
    } else {
      hunk ||= { was: [], is: [] };
      if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) hunk.is.push(b[j++]);
      else hunk.was.push(a[i++]);
    }
  }
  flush();
  return out;
}

// Whether every difference between a test's old and new body follows the production code.
function followsCode(was, is, oldNames, newNames, code) {
  return hunks(tokens(was), tokens(is)).every(({ was, is }) => {
    // the new side: one name, maybe qualified (ConnectFour::NoMove), that the production code just gained
    const name = is[is.length - 1];
    const qualified = is.every((t, k) => (k % 2 ? t === "::" : NAME.test(t))) && is.length % 2 === 1;
    if (!qualified || !newNames.has(name)) return false;
    // renamed: the old name is gone from the production code
    if (was.length === 1 && oldNames.has(was[0])) return true;
    // a magic number made a constant: the constant has the literal's value
    const literal = was.join("");
    if (!LITERAL.test(was[was.length - 1]) || !(was.length === 1 || (was.length === 2 && was[0] === "-"))) return false;
    return new RegExp(`\\b${escape(name)}\\s*(?:=|\\{|\\()\\s*${escape(literal)}(?![\\w.])`).test(code);
  });
}

const namesIn = (code) => new Set(tokens(code).filter((t) => NAME.test(t)));

// The tests the pair changed beyond following the code: {added, removed, changed}.
export function labTestChanges(base, now) {
  const c = testChanges(base, now);
  if (!c.changed.length) return c;
  const was = namesIn(productionCode(base));
  const code = productionCode(now);
  const is = namesIn(code);
  const oldNames = new Set([...was].filter((n) => !is.has(n)));
  const newNames = new Set([...is].filter((n) => !was.has(n)));
  const before = testBodies(base);
  const after = testBodies(now);
  return { ...c, changed: c.changed.filter((name) => !followsCode(before[name], after[name], oldNames, newNames, code)) };
}

const testsUnchanged = (base, now) => {
  const c = labTestChanges(base, now);
  return !c.added.length && !c.removed.length && !c.changed.length;
};

// A lab phase's to-do list, against `base` (the code at the last commit, or at
// the start): [{text, ok, reason?}]. The text is the task and never changes;
// ok true = done, false = a problem (reason says what), null = not done yet.
// goalMet when every item is done, so Done may be clicked.
export function labStatus(phase, base, now) {
  if (!now) return null;
  const lines = [];
  const testsLine = { text: "Keep the tests the same (renames are fine)", ok: true };
  if (!testsUnchanged(base, now))
    Object.assign(testsLine, { ok: false, reason: "You changed what a test checks: put it back" });
  if (phase === "refactor") {
    lines.push({ text: "Make one refactoring in the production code", ok: productionCode(now) !== productionCode(base) || null });
    lines.push(testsLine);
  } else if (phase === "test") {
    lines.push(testsLine);
    const run = { text: "Run all the tests (Ctrl+R, A): every test passes", ok: true };
    if (buildFailed(now)) Object.assign(run, { ok: false, reason: "The code doesn't build: fix it, or undo the last change" });
    else if (staleResults(now) || !currentTests(now).length) run.ok = null;
    else if (failingTests(now).length)
      Object.assign(run, { ok: false, reason: `${failingTests(now).join(", ")} fails: undo the last change, then run the tests again` });
    lines.push(run);
  } else if (phase === "commit") {
    const git = now.git;
    if (!git?.repo) lines.push({ text: "Commit if you can (no git repository, so it can't be checked)", ok: true });
    else {
      const moved = !!git.head && git.head !== base?.git?.head;
      lines.push({ text: "Commit, with a message that names the refactoring", ok: moved || null });
      const dirty = uncommittedFiles(now);
      const left = { text: "Leave nothing uncommitted", ok: !dirty.length || (moved ? false : null) };
      if (dirty.length) left.reason = `Not committed yet: ${dirty.slice(0, 3).join(", ")}${dirty.length > 3 ? "…" : ""}`;
      lines.push(left);
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
