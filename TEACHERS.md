# Running a class with RedGreenGo

Students practise test-driven development in pairs: they write C++ and GoogleTest code in Visual
Studio, and the game coaches them through Red, Green and Refactor. A small coach server keeps
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

1. A Visual Studio C++ project with GoogleTest tests, in a git repository.
2. Download the helper, [rgg_server.py](https://kenpower.github.io/RedGreenGoWeb/build/rgg_server.py),
   into the solution folder (next to the `.sln`). It needs Python 3.
3. Open a terminal in the solution folder (Visual Studio: **Tools → Command Line → Developer
   PowerShell**, or right-click the solution in Solution Explorer → **Open in Terminal**) and run
   `python rgg_server.py --class-code SD2-2026` (`py` instead of `python` if the Microsoft Store
   opens). The game opens in the browser.
4. Play at **http://127.0.0.1:8000/**, the page the helper opens, not at github.io: Chrome blocks
   the github.io page from talking to the helper.
5. Optional: a `README.md` in the solution folder that describes the problem, with a line
   `Class code: SD2-2026`. The coach reads the problem, and the helper then picks up the class code
   without `--class-code`.
6. Run the tests once (**Test → Run All Tests**), enter both names and click **Start Game**. Tell
   them to use Run All: a run of only some tests leaves the others' results from earlier.

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

**Prepare the starter project:** a Visual Studio solution with working (but messy) code and
GoogleTest tests that cover it and all pass, committed to git. Its README.md says what the code
does and has these lines:

```
Class code: SD2-2026
Lab: refactor
Refactorings: Extract Function, Rename Variable, Replace Magic Number with Constant, Decompose Conditional
```

`Lab: refactor` switches the game to the lab. `Refactorings:` lists the ones the coach may
suggest; without it the coach uses a basic list. Students set up as in section 3.

**How it runs:**

- The coach reads the code and shows a smell board: up to 8 things worth tidying, each with a
  refactoring from your list. Pairs pick the order.
- Each round is **refactor → run tests → commit**: one refactoring, Run All Tests (all must still
  pass), then a commit naming the refactoring. They swap driver and navigator after each commit.
- **The tests may not change.** Editing a test, or changing what the code does, holds the pair
  until they put it back. Mixing two refactorings in one commit, or making the code worse, is
  only advice.
- A failing test locks the step until they undo the last change.
- The lab ends when the coach agrees the board is clear, or the pair clicks Finish.

During and after the lab, `progress` shows each pair's **rounds** and **revert** (changes undone
after breaking a test). The `--csv` export adds their commits and how many of each refactoring
they applied, e.g. `Extract Function:3; Rename Variable:1`.

## 7. Not ready yet: the live class view

`rgg-coach-admin teacher-link SD2-2026` already prints a secret link for a live view of the class
(a tile per pair, refreshed every 15 seconds, with stuck pairs flagged, timelines and rubric
grades). The page that link opens isn't built yet, so use `progress` for now. When it is, keep the
link to yourself: anyone with it can see the class and change grades (`--rotate` makes a new one).
