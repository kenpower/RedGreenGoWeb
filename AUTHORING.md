# Writing a RedGreenGo exercise

For an agent (or teacher) making a C++ exercise in its own repo that students play with
RedGreenGo (RGG). It says what RGG reads from the repo, the exact README format it parses,
and how to check the result before students see it. The working example is the Connect Four
refactor lab, `Connect4-Refactoring-Worksheet` (branch `master` for the starter, `solution`
for the worked answer).

RGG reads the exercise; it never changes it. Everything below is a contract with code in this
repo: `rgg_server.py` (the helper), `src/lab.js`, `src/worksheet.js`, `src/rules.js`.

## Two kinds of exercise

| | TDD game | Refactor lab |
|-|-|-|
| Students start with | a problem, maybe a placeholder test | working, messy code whose tests all pass |
| The game's loop | Red → Swap → Green → Refactor | Refactor → Test → Commit, one refactoring per round |
| Chosen by | no `Lab:` line | `Lab: refactor` in the README |
| The README is | the problem description the coach reads | settings plus, optionally, a numbered worksheet the game walks through |

A refactor lab can include **Develop** steps (behaviour changes, tests first) and can end with
"switch to TDD"; you don't need a TDD exercise for that.

## The repo

- **C++ with GoogleTest**, in a **git repository** with the starter committed. Students commit
  as they go; the lab checks each commit.
- **A build the helper can read results from**, one of:
  - a Visual Studio solution (`.sln`/`.slnx` + `.vcxproj`): the Google Test adapter writes
    `XMLGoogleTestResults.xml` by itself;
  - **CMake** (Visual Studio Open Folder, VS Code, CLion, command line). `CMakeLists.txt` must
    save each test's result, or the game never sees a run:

    ```cmake
    include(GoogleTest)
    gtest_discover_tests(my_tests XML_OUTPUT_DIR ${CMAKE_BINARY_DIR}/test-results)
    ```

    Runs through CTest are seen (Test Explorer, VS Code's Testing view, CLion's **All CTest**,
    `ctest`). Running the test program directly isn't: say so in the build instructions.
- **`README.md`** at the repo root (or one folder down). Up to 60,000 characters are read.
- **`rgg_server.py`** at the root is optional: commit a copy, or students download it. A
  committed copy doesn't update itself; copy it again from this repo after each RGG release.
- **Sources**: the helper reads `.cpp`, `.cc`, `.h`, `.hpp` files (at most 50, each under
  100 KB), skipping build folders (any folder with a `CMakeCache.txt`, `build`, `out`,
  `cmake-build-*`, `_deps`, `Debug`, `Release`, `x64`…), dot folders and `pch`/`stdafx` files.
  A file is a **test file** if it contains `TEST(`, `TEST_F(` or `TEST_P(`; anything else is
  production code. Keep the exercise to a few files.
- **`.gitignore`** the build folders, so "Leave nothing uncommitted" only sees real sources.

## Tests

- Name tests `TEST(Suite, WhatItChecks)`: the game shows `Suite.WhatItChecks`, and students
  read it. One behaviour per test.
- **Refactor lab:** every test passes on the starter. The tests are the safety net, so they
  must cover what the refactorings touch. The game holds a pair that changes what a test
  checks, except for edits that follow the production code:
  - a rename carried into the tests (`move` → `bestMoveFor` everywhere);
  - a literal replaced by a new constant with that value (`-1` → `ConnectFour::NoMove`, when
    the code gained `NoMove = -1`).

  Anything else (a new test, a changed expected value, a renamed test) is a Develop step.
- **TDD game:** the starter may have no tests, or one placeholder. The game asks for one failing
  test at a time.

## README format

### Settings lines (anywhere, usually at the top)

```
Class code: SD2_2026
Lab: refactor
Refactorings: Rename Function, Rename Variable, Extract Function, Replace Magic Number with Constant
```

- `Class code: CODE`: letters, digits, `-` and `_`, 2 to 40 characters. The helper and the game
  pick it up, so students don't type it. The class must exist on the coach server
  (`rgg-coach-admin add-class CODE "Name"`; see TEACHERS.md).
- `Lab: refactor` makes the game a refactor lab. Leave it out for a TDD game.
- `Refactorings:` lists the refactorings the lab practises, comma-separated (at most 20). The
  coach uses only these for its smell board, and the teacher's count of kinds uses these
  spellings. Use names from the game's glossary where they fit, so students get a definition
  and a tiny before/after: Rename Variable, Rename Function, Extract Function, Replace Magic
  Number with Constant, Decompose Conditional, Split Loop, Merge Loops, Inline Variable, Inline
  Function, Introduce Explaining Variable, Consolidate Duplicate Conditional Fragments, Replace
  Loop with Algorithm, Replace Nested Conditional with Guard Clauses, Replace Primitive with
  Object, Remove Dead Code. Without the line, the lab uses Extract Function, Rename Variable,
  Replace Magic Number with Constant and Decompose Conditional.

### A TDD game's README

Plain prose: what to build, the rules, examples. The coach reads the first 8,000 characters as
the problem, says back what it thinks the pair is building, and judges each step against it.
Write it for students, not for the coach. Don't list the tests to write: finding the next test
is the exercise.

### A refactor lab's worksheet

Without numbered steps, the coach reads the code and makes a smell board, and pairs choose the
order. With them, **the game walks the worksheet**: the card shows the current step and its text,
moves on after each commit, and switches between Refactor and Develop by itself.

**Sections** are numbered `##` headings. Steps belong to the section above them:

```markdown
## 2. Easy changes
## 5. More ways to win (if you have time)
## 6. A smarter player (take-home)
```

A title ending in `(if you have time)` or `(take-home)` marks all its steps optional. Headings
without a number (`## Wrap-up`, `# Submission`) end the steps. Section **1** is special when the
repo has a `smells.md` (below): its text is shown while the pair lists smells.

**Steps** use either of two formats, each with a unique `N.M` number and a hat, `[Refactor]` or
`[Develop]`:

1. A checklist item. The first line is the step's **headline**; the lines indented two spaces
   under it (after a blank line, for paragraphs, code and notes) are its body:

   ```markdown
   - [ ] **2.4 [Refactor]** Extract `r * 7 + c` into a private method `indexOf()`.

     The expression `r * 7 + c` (row × width + column) appears **many** times:

     ```cpp
     int indexOf(int row, int column) const;
     ```

     > 💡 **Hint:** the `+ 1` in `board[r * 7 + c + 1]` belongs to the column.
   ```

2. A `###` heading. The title is the headline; the body runs to the next heading:

   ```markdown
   ### Step 3.4 [Develop]: change of hat. Simplify the default move

   The rules only say "play **any** legal move". Delete the guard...
   ```

   A title ending in `(if you have time)` marks just that step optional.

Any other `###` heading (e.g. `### Further stretch (pick any)`) ends the step before it and isn't
a step. Headings and items inside code blocks are ignored.

**Writing the steps:**

- **One step, one round:** one refactoring, then run the tests, then commit. If a step needs several
  commits (e.g. "one kind of number at a time"), say so: the commit card offers "Committed, but
  step N.M isn't finished yet". If two steps share one commit, say "commit when N.M+1 passes,
  then Skip".
- **The headline is the card's "do this now" line.** Make it one short instruction (under about
  100 characters): "Extract `r * 7 + c` into a private method `indexOf()`." Put explanations,
  questions and hints in the body.
- **`[Refactor]`**: behaviour stays the same and every test stays green; the tests may change
  only by following renames or new constants.
- **`[Develop]`**: behaviour changes. The game expects failing tests, lets the pair edit and add
  tests, and treats a build that fails because the tests came first as expected. The step ends
  when everything builds and every test passes. Use it for relaxing an over-specified test,
  adding a feature test-first, or a new class written test-first.
- **Body Markdown:** paragraphs, `code`, `**bold**`, `*italic*`, fenced code blocks, `>` notes,
  tables and `-` lists. Links show their text only. Raw HTML is shown as text, never run: don't
  use it.
- Step and test names in the body help the coach: it compares each change with the current step
  and says so when the change doesn't match (advice, never a hold).
- Keep game instructions out of steps: the game says when to run the tests and commit, and
  shows each IDE's keys. A short "Start RedGreenGo" section in setup is enough.

### Commit messages

Tell students to name the refactoring first: `Extract Function: indexOf`, or
`Rename Function: move -> bestMoveFor`; and `Develop: any legal move` for Develop steps. The
game suggests messages like these, and the teacher's dashboard counts each refactoring the
pair completed from them (once per committed round, matched to the `Refactorings:` names).

## `smells.md` (optional, refactor lab)

If the repo has a `smells.md`, the lab starts with "smells first": the coach's smell board,
its hints and (in a worksheet lab) step 2.1 wait until the pair has added **3 rows** of their own
(or skips). With a table, only new rows with something in them count; empty template rows and
the pair's names don't:

```markdown
# Smell log

**Pair:** _name_ & _name_

|Line(s)|Smell|What's wrong|Fixed in|
|-|-|-|-|
|23|Poor name|`t` doesn't say what it is||
| | | | |
| | | | |
| | | | |
```

Ask for "at least three rows" in section 1, so the README and the game agree.

## A worked solution, and checking it

Put the worked answer on a `solution` branch off the starter: **one commit per step**, each one
green, each message starting with its step number and then the message a student would write:

```
2.1 Rename Function: move -> bestMoveFor
3.4 Develop: any legal move, not just the first
4.1 Replace Magic Number with Constant: Columns     (several commits may share a step)
5.1-5.2 Develop: vertical and diagonal wins         (one commit for two steps)
```

Then, from a checkout of this repo (RedGreenGoWeb, with `npm install` done):

```bash
node scripts/check_exercise.mjs ../my-exercise                  # base master, branch solution
node scripts/check_exercise.mjs ../my-exercise --base main --solution worked
```

It reads the exercise with git only and reports:

- the settings it found (class code, lab, refactorings);
- the source files the helper will read, and whether each is a test or production file;
- missing pieces (no tests, a `CMakeLists.txt` without `XML_OUTPUT_DIR`, too many files);
- every worksheet step with its hat, optional tag and headline, flagging duplicates, long
  headlines and HTML;
- the `solution` branch replayed through the lab's own state and rules, one round per commit:
  - each round's gates (`refactor → test → commit`, or `develop → commit`), and why any round
    would be held;
  - where a pair would have to Skip;
  - the refactorings counted.

It exits 1 on any problem. Fix every problem before students see the exercise, and read the
notes. A `[Refactor]` commit held for "You changed what a test checks" means either the step
should be `[Develop]`, or the tests changed more than a rename or a new constant. "Every step
done" at the end means the worksheet and the solution agree.

The checker can't see:

- whether the code builds and the tests pass: it assumes each solution commit is green, so
  build and run them yourself;
- how the coach will read the code (that needs the coach server and a class code);
- what the card looks like: play the first steps in the game (`python rgg_server.py` in the
  exercise folder).

## Checklist

- [ ] Starter committed; every test passes (refactor lab); build folders ignored.
- [ ] CMake: `XML_OUTPUT_DIR` on `gtest_discover_tests`. Visual Studio solution: nothing extra.
- [ ] README: `Class code:`, `Lab: refactor` (for a lab), a `Refactorings:` line with glossary names.
- [ ] Worksheet: numbered sections, `N.M [Refactor]`/`[Develop]` steps, unique numbers, short
      headlines, multi-commit and shared-commit steps explained.
- [ ] `smells.md` table with example rows and empty rows, if section 1 asks for smells.
- [ ] A `solution` branch, one green commit per step; `scripts/check_exercise.mjs` says
      "No problems" and "every step done".
- [ ] The class exists on the coach server (`rgg-coach-admin add-class`).
- [ ] If `rgg_server.py` is committed, it's the copy from the latest RGG release.
