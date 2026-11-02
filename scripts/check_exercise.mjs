// Checks an exercise repo the way the game will read it (see AUTHORING.md):
// the README's lab settings and worksheet steps, and, given a solution branch,
// replays its commits through the refactor lab's own state and rules, one
// round per commit, as a pair would play them.
//
//   node scripts/check_exercise.mjs <exercise repo> [--base master] [--solution solution]
//
// Reads the repo with git only (show, log, ls-tree); never changes it.
// Solution commits name their step first ("2.1 Rename Function: move -> bestMoveFor",
// "3.4 Develop: ..."); several commits may share a step. Exits 1 on any problem.
import { execFileSync } from "child_process";

const store = {}; // the game state saves itself to localStorage
globalThis.localStorage = { setItem: (k, v) => (store[k] = v), getItem: (k) => store[k] ?? null, removeItem: (k) => delete store[k] };
const { GameState } = await import("../src/gameState.js");
const { labStatus, parseLab } = await import("../src/lab.js");
const { parseWorksheet, stepHeadline } = await import("../src/worksheet.js");
const { classCodeFromReadme } = await import("../src/coach.js");

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const repo = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!repo) {
  console.log("usage: node scripts/check_exercise.mjs <exercise repo> [--base master] [--solution solution]");
  process.exit(2);
}
const base = option("--base", "master");
const solution = option("--solution", "solution");
const git = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const hasRef = (ref) => {
  try {
    git("rev-parse", "--verify", "--quiet", ref);
    return true;
  } catch {
    return false;
  }
};

let problems = 0;
const problem = (text) => {
  problems++;
  console.log(`  PROBLEM: ${text}`);
};

// ---- The README, as the helper sends it and the game reads it
const readme = git("show", `${base}:README.md`);
const lab = parseLab(readme);
const worksheet = parseWorksheet(readme);
console.log(`README.md at ${base}: ${readme.length} characters`);
console.log(`  Class code: ${classCodeFromReadme(readme) || "(none: students type it)"}`);
console.log(`  Lab: ${lab ? "refactor" : "none: a TDD game"}${lab ? `; Refactorings: ${lab.refactorings.join(", ")}` : ""}`);
if (readme.length > 60_000) problem("README.md is over 60,000 characters: the helper cuts it there");
if (!lab && readme.length > 8_000) console.log("  note: a TDD game's coach reads only the first 8,000 characters");

const SOURCE = /\.(cpp|cc|h|hpp)$/i;
const SKIPPED = /^(pch|stdafx|framework|targetver)\.(h|cpp)$/i;
const isSource = (path) =>
  SOURCE.test(path) && !SKIPPED.test(path.split("/").pop()) &&
  !path.split("/").slice(0, -1).some((d) => d.startsWith(".") || d.startsWith("cmake-build-") || d === "_deps" ||
    ["packages", "x64", "x86", "Win32", "ARM64", "Debug", "Release", "out", "build"].includes(d));
const files = (rev) =>
  git("ls-tree", "-r", "--name-only", rev)
    .split("\n")
    .filter(isSource)
    .map((path) => {
      const content = git("show", `${rev}:${path}`);
      return { path, kind: /\bTEST(?:_F|_P)?\s*\(/.test(content) ? "test" : "production", content, mtime: 1 };
    });

const starter = files(base);
console.log(`  Source files the helper reads: ${starter.map((f) => `${f.path} (${f.kind})`).join(", ") || "none"}`);
if (!starter.some((f) => f.kind === "test")) problem("no test file: the helper finds tests by TEST( / TEST_F( / TEST_P(");
if (starter.length > 50) problem("over 50 source files: the helper reads only the first 50");
const tree = git("ls-tree", "-r", "--name-only", base).split("\n");
const cmake = tree.includes("CMakeLists.txt") ? git("show", `${base}:CMakeLists.txt`) : null;
if (cmake && /gtest_discover_tests/.test(cmake) && !/XML_OUTPUT_DIR/.test(cmake))
  problem("CMakeLists.txt doesn't save test results: add XML_OUTPUT_DIR ${CMAKE_BINARY_DIR}/test-results to gtest_discover_tests");
if (!cmake && !tree.some((p) => /\.(slnx?|vcxproj)$/.test(p))) problem("no CMakeLists.txt and no Visual Studio solution");
if (!tree.includes("rgg_server.py")) console.log("  note: no rgg_server.py in the repo: students download it");
if (tree.some((p) => p.toLowerCase() === "smells.md")) {
  const smells = git("show", `${base}:${tree.find((p) => p.toLowerCase() === "smells.md")}`);
  console.log(`  smells.md: the coach's board waits for 3 of the pair's own ${smells.includes("\n|") ? "table rows" : "lines"}`);
}

// ---- The worksheet's steps
if (worksheet.steps.length) {
  console.log(`\nWorksheet: ${worksheet.steps.length} steps`);
  const ids = new Set();
  for (const s of worksheet.steps) {
    const headline = stepHeadline(s);
    console.log(`  ${s.id.padEnd(5)} ${s.hat.padEnd(8)} ${(s.optional || "").padEnd(16)} ${headline}`);
    if (ids.has(s.id)) problem(`step ${s.id} appears twice`);
    ids.add(s.id);
    if (headline.length > 100) console.log(`        note: a long headline (${headline.length} characters); keep the first line a short instruction`);
    if (/<[a-z/][^>]*>/i.test(s.body)) console.log("        note: raw HTML in the body is shown as text, not rendered");
  }
  if (!lab) problem('worksheet steps without "Lab: refactor": the game ignores them');
} else if (lab) console.log("\nWorksheet: no numbered steps: the lab follows the coach's smell board");

// ---- The solution branch, replayed as rounds
if (!hasRef(solution)) {
  console.log(`\nNo ${solution} branch: nothing to replay.`);
} else if (!lab) {
  console.log(`\n${solution}: not a refactor lab, so no replay.`);
} else {
  const snapshot = (rev, message) => {
    const fs = files(rev);
    const names = fs
      .filter((f) => f.kind === "test")
      .flatMap((f) => [...f.content.matchAll(/\bTEST(?:_F|_P)?\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g)].map((m) => `${m[1]}.${m[2]}`));
    // every solution commit should be green: its tests passed after the last save
    return {
      files: fs, build: null, runTime: 2,
      tests: names.map((name) => ({ name, status: "passed", message: "" })),
      git: { repo: true, head: rev, headMessage: message, dirtySource: [] },
    };
  };
  const steps = worksheet.steps.map((s) => ({ ...s, title: stepHeadline(s) }));
  const g = new GameState();
  g.startLab(lab.refactorings, snapshot(base, ""), null, steps);
  const log = git("log", "--reverse", "--format=%h %s", `${base}..${solution}`).trim().split("\n").filter(Boolean);
  const stepOf = (subject) => subject.match(/^(\d+\.\d+)\b/)?.[1] || null;
  console.log(`\n${solution}: ${log.length} commits, one round each`);
  for (const [n, line] of log.entries()) {
    const [rev, ...words] = line.split(" ");
    const subject = words.join(" ");
    const id = stepOf(subject);
    let note = "";
    if (steps.length && !id) problem(`${rev} "${subject}": start the message with its step number`);
    if (id && !steps.some((s) => s.id === id)) problem(`${rev} "${subject}": no step ${id} in the README`);
    else if (id && g.lab.step !== id) {
      note = ` (the pair moves ${g.lab.step ?? "past the end"} -> ${id})`;
      g.labGotoStep(id);
    }
    const stayOnStep = !!id && stepOf(log[n + 1]?.split(" ").slice(1).join(" ") || "") === id;
    const snap = snapshot(rev, subject.replace(/^[\d.\-]+\s+/, "")); // students' messages don't start with the number
    const gates = [];
    // refactor -> test -> commit, or develop -> commit: each phase's Done gate, as the card checks it
    for (;;) {
      const phase = g.lab.phase;
      const status = labStatus(phase, g.lab.base, snap);
      gates.push(status.goalMet ? `${phase} ok` : `${phase} HELD`);
      if (!status.goalMet) {
        const held = status.lines.filter((l) => l.ok !== true).map((l) => l.reason || l.text);
        problem(`${rev} "${subject}" is held at ${phase}: ${held.join("; ")}`);
        break;
      }
      g.labDone(snap, { stayOnStep: phase === "commit" && stayOnStep });
      if (phase === "commit") break;
    }
    console.log(`  ${(id || "-").padEnd(5)} ${gates.join(", ").padEnd(34)} ${subject}${note}`);
  }
  console.log(`  refactorings counted: ${Object.entries(g.refactorings).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
  if (steps.length) console.log(`  after the last commit: ${g.lab.step === null ? "every step done" : `on step ${g.lab.step}`}`);
}

console.log(problems ? `\n${problems} problem(s)` : "\nNo problems.");
process.exit(problems ? 1 : 0);
