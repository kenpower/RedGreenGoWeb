# RedGreenGo: quick start

You and your partner practise test-driven development: one failing test, the simplest code that
passes it, then tidy up. A coach watches each step and helps when you get stuck.

## Set up (once)

1. Open your C++ project. It needs GoogleTest tests and a git repository. Either:
   - a **Visual Studio solution** (a `.sln` or `.slnx` file), opened in Visual Studio, or
   - a **CMake project** (a `CMakeLists.txt` file), opened as a folder in Visual Studio, VS Code or
     CLion, on Windows or Linux. Your teacher's starter project is already set up for the game.
2. Download [rgg_server.py](https://kenpower.github.io/RedGreenGoWeb/build/rgg_server.py) into your
   project folder: the one with the `.sln` file, or the one with `CMakeLists.txt`. You need Python 3.
   If your teacher's starter project already has `rgg_server.py` in it, skip the download and use that one.
3. Open a terminal in that folder:
   - **Visual Studio:** **Tools → Command Line → Developer PowerShell** (or **View → Terminal**),
     which opens there. Or, in Solution Explorer, right-click the solution and choose **Open in Terminal**.
   - **VS Code:** **Terminal → New Terminal**.
   - **CLion:** **View → Tool Windows → Terminal**.

   Then run, with your teacher's class code:

   ```
   python rgg_server.py --class-code YOURCODE
   ```

   On Windows, if `python` opens the Microsoft Store or says it isn't found, use
   `py rgg_server.py --class-code YOURCODE`. On Linux, use `python3`.
   Type `dir rgg_server.py` (Linux: `ls rgg_server.py`) first if you're not sure you're in the right
   folder: it should list the file. Leave it running. It only reads your files; it never changes them.
4. The game opens at **http://127.0.0.1:8000/**. Always play there: the github.io page can't see
   your code, because Chrome blocks it.
5. Optional: put a `README.md` in the solution folder that says what you're building, plus a line
   `Class code: YOURCODE`. The coach reads the problem, and you can then run plain
   `python rgg_server.py`.
6. Run all your tests once. The helper opens the game when the results arrive, or after 10 seconds.
   Type both your names and click **Start Game**. Always run **all** the tests, this way:
   - **Visual Studio:** **Test → Run All Tests**.
   - **VS Code:** the **Testing** view (the flask icon), then **Run Tests**.
   - **CLion:** the **All CTest** run configuration (top right). Not the green ▶ next to a test:
     the game can't see those runs.
   - **Command line:** `ctest --test-dir build`.

## How a game goes

- **The coach's reading.** After Start, a card shows what the coach thinks you're building, where
  your code stands and a first move. Click **That's right**, or fix it with **Not quite: edit the
  problem** or **Read my code again**. You can reopen it from the line at the top.
- **Red.** The navigator says what the next test checks; the driver writes that one test. Run all
  the tests and click **Done** when exactly one test fails.
- **Swap.** Change driver and navigator.
- **Green.** Write the simplest code that makes the test pass. Click **Done** when all tests pass.
- **Refactor.** Tidy names and remove duplication without changing what the code does. Click
  **Done** when it's tidier and still green. Commit, then back to Red.
- **A test passes straight away?** Either your code already does that (**Keep it**) or the test
  doesn't check what you think (pick a behaviour the code doesn't do yet).
- **Finished?** When you think the problem is solved, ask the coach. It may suggest a missing case.

## Refactor lab

If your project's README.md has a line `Lab: refactor`, the game is a refactor lab instead: you
start with messy code whose tests all pass, and you tidy it up.

- **The smell board.** After Start, the coach lists what's worth tidying and which refactoring
  fits each one, using only the refactorings in your README's `Refactorings:` line. You pick the
  order.
- **Each round is refactor → run tests → commit:**
  1. **Refactor.** One refactoring at a time, e.g. one Extract Function.
  2. **Run tests.** Run All Tests. Everything must still pass. If a test fails, undo your last
     change and try a smaller step.
  3. **Commit.** Commit with a message naming the refactoring
     (e.g. "Extract Function: totalPrice"). Then swap driver and navigator.
- **Don't change the tests.** They prove the code still does the same thing. Editing a test, or
  changing what the code does, holds you until you put it back.
- **A step that changes behaviour on purpose** (a [Develop] step in your worksheet)? Click
  **Changing what the code does on purpose?**, say what will change, and the game lets tests fail
  and change until they all pass again. Then you commit and carry on refactoring.
- **Done** when the board is clear, or click **Finish** if you run out of time.

## When the coach holds you

The coach may say **Stay on this step** with a question to think about. That's the hint:

1. Read the **Think** question and try again.
2. Still stuck? **More help** says what kind of thing to look for, then exactly what to do.
3. After three tries on the same step, **Show me the code** shows a fix and explains why.

If you're sure the coach is wrong, **Progress despite this advice** moves on (your teacher sees
how often you use it).

Your teacher can see each pair's progress, the coach's notes, your test names and commit messages,
but not your code.
