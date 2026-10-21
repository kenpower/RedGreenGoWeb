# RedGreenGo: quick start

You and your partner practise test-driven development: one failing test, the simplest code that
passes it, then tidy up. A coach watches each step and helps when you get stuck.

## Set up (once)

1. Open your C++ project in Visual Studio. It needs GoogleTest tests and a git repository.
2. Download [rgg_server.py](https://kenpower.github.io/RedGreenGoWeb/build/rgg_server.py) into your
   solution folder (the one with the `.sln` file). You need Python 3.
3. Open a terminal in that folder and run, with your teacher's class code:

   ```
   python rgg_server.py --class-code YOURCODE
   ```

   Leave it running. It only reads your files; it never changes them.
4. The game opens at **http://127.0.0.1:8000/**. Always play there: the github.io page can't see
   your code, because Chrome blocks it.
5. Optional: put a `README.md` in the solution folder that says what you're building, plus a line
   `Class code: YOURCODE`. The coach reads the problem, and you can then run plain
   `python rgg_server.py`.
6. Run your tests once in Test Explorer, type both your names and click **Start Game**.

## How a game goes

- **The coach's reading.** After Start, a card shows what the coach thinks you're building, where
  your code stands and a first move. Click **That's right**, or fix it with **Not quite: edit the
  problem** or **Read my code again**. You can reopen it from the line at the top.
- **Red.** The navigator says what the next test checks; the driver writes that one test. Run the
  tests in Visual Studio and click **Done** when exactly one test fails.
- **Swap.** Change driver and navigator.
- **Green.** Write the simplest code that makes the test pass. Click **Done** when all tests pass.
- **Refactor.** Tidy names and remove duplication without changing what the code does. Click
  **Done** when it's tidier and still green. Commit, then back to Red.
- **A test passes straight away?** Either your code already does that (**Keep it**) or the test
  doesn't check what you think (pick a behaviour the code doesn't do yet).
- **Finished?** When you think the problem is solved, ask the coach. It may suggest a missing case.

## When the coach holds you

The coach may say **Stay on this step** with a question to think about. That's the hint:

1. Read the **Think** question and try again.
2. Still stuck? **More help** says what kind of thing to look for, then exactly what to do.
3. After three tries on the same step, **Show me the code** shows a fix and explains why.

If you're sure the coach is wrong, **Progress despite this advice** moves on (your teacher sees
how often you use it).

Your teacher can see each pair's progress, the coach's notes, your test names and commit messages,
but not your code.
