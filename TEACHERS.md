# Running a class with RedGreenGo

Students practise test-driven development in pairs: they write C++ and GoogleTest code in Visual
Studio (a solution), or in a CMake project opened in Visual Studio, VS Code or CLion, and the game
coaches them through Red, Green and Refactor. A small coach server keeps
your class code, its daily allowance and each pair's progress.

You run every command below from your own computer, in a terminal (Git Bash, WSL or macOS). Each
one logs in to the coach server over ssh, so it may ask for your password. Server setup and
deploying are in [coach/deploy/README.md](coach/deploy/README.md).

## 1. Create the class

Pick a short code with no spaces, e.g. `SD2-2026`. Students type it into the game.

```bash
ssh -t ken@compucore3.setu.ie 'rgg-coach-admin add-class SD2-2026 "Software Dev 2, 2026"'
ssh -t ken@compucore3.setu.ie rgg-coach-admin classes
curl https://compucore3.setu.ie/rgg-coach/health
```

`classes` lists every class with today's use. The `curl` line should print `{"status": "ok"}`;
if it doesn't, the coach is down (see the deploy README).

Codes aren't case-sensitive: `sd2-2026` works too. To stop a class using the coach:
`ssh -t ken@compucore3.setu.ie rgg-coach-admin disable-class SD2-2026`.

## 2. Tell the students what is stored

Before they use the class code, tell them that for each game the server keeps:

- the pair's names, as typed on the start screen
- the coach's notes and the rule findings shown to them
- what they said each new test would check, and their predictions
- the coach's one-line summary of what they are building, and any problem text they type to correct it
- the names of their tests when they finish, and their git commit messages
- the time of each step, and the IP address the game last reported from

**No code is stored.** The coach reads their code to give advice but the server doesn't keep it.
You can delete it all after the module (section 5).

## 3. Student setup

Give the students [STUDENTS.md](STUDENTS.md). In short:

1. A C++ project with GoogleTest tests, in a git repository: a Visual Studio solution, or a CMake
   project (see [CMake projects](#cmake-projects) below).
2. Download the helper, [rgg_server.py](https://kenpower.github.io/RedGreenGoWeb/build/rgg_server.py),
   into the project folder (next to the `.sln`, or next to `CMakeLists.txt`). It needs Python 3.
3. Open a terminal in that folder (Visual Studio: **Tools → Command Line → Developer PowerShell**,
   or right-click the solution in Solution Explorer → **Open in Terminal**; VS Code: **Terminal →
   New Terminal**; CLion: **View → Tool Windows → Terminal**) and run
   `python rgg_server.py --class-code SD2-2026` (`py` instead of `python` if the Microsoft Store
   opens; `python3` on Linux). The game opens in the browser.
4. Play at **http://127.0.0.1:8000/**, the page the helper opens, not at github.io: Chrome blocks
   the github.io page from talking to the helper.
5. Optional: a `README.md` in the solution folder that describes the problem, with a line
   `Class code: SD2-2026`. The coach reads the problem, and the helper then picks up the class code
   without `--class-code`.
6. Run the tests once (**Test → Run All Tests**; VS Code: the Testing view; CLion: **All CTest**),
   enter both names and click **Start Game**. Tell them to use Run All: a run of only some tests
   leaves the others' results from earlier.

### CMake projects

The helper reads the GoogleTest results that each test run saves. Visual Studio's test adapter
saves them by itself for a solution, but a CMake project has to ask for it, with
`XML_OUTPUT_DIR` on the line that registers the tests in `CMakeLists.txt`:

```cmake
gtest_discover_tests(my_tests XML_OUTPUT_DIR ${CMAKE_BINARY_DIR}/test-results)
```

Without it the helper warns at start-up and the game never sees a test run. With it, every run
through CTest is seen: Visual Studio's Test Explorer, VS Code's Testing view, CLion's **All CTest**
configuration, and `ctest` on the command line. Running the test program directly (CLion's green
▶ beside a test, or `./build/my_tests`) isn't seen, so tell CLion users to use **All CTest**.

A CMake starter project can also download the latest `rgg_server.py` each time the IDE opens
the folder, so students skip step 2: see the `rgg_server.py` snippet in
[AUTHORING.md](AUTHORING.md#the-repo).

Not yet with CMake: the game doesn't see **build errors**, because a CMake build leaves no log to
read. It does see when the test program is older than the code (the build failed, or `ctest` ran
without a build), and says so instead of passing the run, but it can't explain the error itself. And the
game's own keyboard hints are Visual Studio's (e.g. **Ctrl+R, A** to run the tests).

## 4. During class

```bash
ssh -t ken@compucore3.setu.ie rgg-coach-admin progress SD2-2026
ssh -t ken@compucore3.setu.ie rgg-coach-admin usage
```

`progress` gives one row per pair. Pairs worth a visit:

| column | what it means | visit when |
|---|---|---|
| holds | the coach said "redo" or "back to Red" | it keeps climbing |
| overr | they pressed "Progress despite this advice" | high: they may be skipping the coach |
| rescue | they asked "Show me the code" after being stuck 3 times | 2 or more |
| last active | their last step | no change for 15 minutes |
| 1st ok | % of steps the coach accepted first time | low |
| kept | tests that passed straight away and that they kept | many: their tests may not check anything new |

`usage` shows today's requests and tokens per class; orient, look and rescue count the kinds of
coach call among them.

Each class gets **600 coach requests and 2,000,000 tokens a day**. Whichever runs out first stops
the coach for that class until midnight: the coach answers that the class has used today's
allowance. To raise them, run `add-class` again with the same code:

```bash
ssh -t ken@compucore3.setu.ie 'rgg-coach-admin add-class SD2-2026 "Software Dev 2, 2026" --limit 900 --tokens 3000000'
```

## 5. After class

Export the progress as a spreadsheet (written on the server, then copied back):

```bash
ssh -t ken@compucore3.setu.ie 'rgg-coach-admin progress SD2-2026 --csv > sd2.csv' && scp ken@compucore3.setu.ie:sd2.csv .
ssh -t ken@compucore3.setu.ie rgg-coach-admin progress SD2-2026 --days 7      # only this week's games
```

When the module is over, delete the class's records (it asks you to type the code to confirm):

```bash
ssh -t ken@compucore3.setu.ie rgg-coach-admin clear-progress SD2-2026
```

## 6. A refactor lab

Instead of building code test-first, pairs get messy code whose tests all pass and apply the
refactorings from your lecture.

**Prepare the starter project:** a Visual Studio solution or a CMake project (with the
`XML_OUTPUT_DIR` line above) with working (but messy) code and GoogleTest tests that cover it and
all pass, committed to git. Its README.md says what the code
does and has these lines:

```
Class code: SD2-2026
Lab: refactor
Refactorings: Extract Function, Rename Variable, Replace Magic Number with Constant, Decompose Conditional
```

`Lab: refactor` switches the game to the lab. `Refactorings:` lists the ones the coach may
suggest; without it the coach uses a basic list. Students set up as in section 3.

**How it runs:**

- The coach reads the code and shows a smell board, each smell with a refactoring that fixes it:
  the refactoring steps your README asks for, in its order (up to 24), then at most 3 obvious extras.
  Pairs pick the order.
- **A worksheet README.** When the README numbers its steps, the game follows them: sections
  `## 2. Easy changes`, and steps written either as `- [ ] **2.1 [Refactor]** text` (indented lines
  are its body) or as `### Step 3.4 [Develop]: title`. The card shows the current step, with its
  text, code and notes from the README, and moves on after each commit. Pairs can go back or skip,
  or keep a step for another commit. A `[Develop]` step starts in Develop by itself. A section titled
  `(if you have time)` or `(take-home)` marks its steps so. The smell board becomes the coach's
  view, and the coach checks each change against the step, as advice.
- **Develop steps.** A README step that changes behaviour on purpose (e.g. relaxing an
  over-specified test) would normally hold the pair. They click **Changing what the code does on
  purpose?** and say what will change; failing and edited tests then don't hold them until every
  test passes again, and they commit it as one round. You see each one in the progress as an
  override event, "Develop step: …".
- Each round is **refactor → run tests → commit**: one refactoring, Run All Tests (all must still
  pass), then a commit naming the refactoring. They swap driver and navigator after each commit.
- **The tests may not change.** Editing a test, or changing what the code does, holds the pair
  until they put it back. Mixing two refactorings in one commit, or making the code worse, is
  only advice.
- A failing test locks the step until they undo the last change.
- The lab ends when the coach agrees the board is clear, or the pair clicks Finish.

During and after the lab, `progress` shows each pair's **rounds**, **revert** (changes undone
after breaking a test) and **kinds**: how many different refactorings they have completed, e.g. 4
for Rename Function, Rename Variable, Extract Function and Merge Loops. A refactoring counts once,
when its round is committed: named by the commit message if it names one ("Extract Function:
indexOf"), else by the coach's review of the change. A Develop step, or a change that broke a test,
counts none. The `--csv` export adds their commits and how many of each refactoring they
completed, e.g. `Extract Function:3; Rename Variable:1`.

## 7. Not ready yet: the live class view

`rgg-coach-admin teacher-link SD2-2026` already prints a secret link for a live view of the class
(a tile per pair, refreshed every 15 seconds, with stuck pairs flagged, timelines and rubric
grades). The page that link opens isn't built yet, so use `progress` for now. When it is, keep the
link to yourself: anyone with it can see the class and change grades (`--rotate` makes a new one).
