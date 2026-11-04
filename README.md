# RedGreenGoWeb

A web version of the [RedGreenGo coaching game](https://github.com/redgreengo). Pairs practise
test-driven development in C++ with GoogleTest. One drives, one navigates, and the roles swap. The
game takes them through Red, Green and Refactor, with an AI coach that reviews each step. A
**refactor lab** takes them through messy code instead, one refactoring at a time:
Refactor, Test, Commit, then swap.

**Play:** https://kenpower.github.io/RedGreenGoWeb/

## Docs

- [STUDENTS.md](STUDENTS.md): a one-page quick start to hand to students
- [TEACHERS.md](TEACHERS.md): running a class (class codes, what's stored, progress, limits)
- [AUTHORING.md](AUTHORING.md): writing an exercise in its own repo (README format, worksheet
  steps, `smells.md`, checking it with `scripts/check_exercise.mjs`)
- [coach/deploy/README.md](coach/deploy/README.md): the coach server (setup, classes, progress,
  teacher view, rollback)

## How it fits together

- **The web app** (`src/`, Svelte): the game itself. It's published to GitHub Pages from `docs/`.
  The game rules live in plain JS (`gameState.js`, `rules.js`, `lab.js`, `worksheet.js`) so they
  can be tested without a browser.
- **The helper** (`rgg_server.py`, Python 3, standard library only): students run it in their
  project folder. It watches their source files, test results, build logs, git and `smells.md`,
  and serves them to the page on `http://127.0.0.1:8000`. It also serves the game page itself
  (`?helper=1` turns the connection on). It only reads; it never changes their files. The build
  copies it to `build/rgg_server.py` so students can download it from the site.
- **The coach** (`coach/`): a small server on compucore3 that holds the Anthropic API key, the
  class codes and each pair's progress. Its prompts are `coach/*.md`. The game still works
  without it, using its own rules.

## Develop

```bash
npm install
npm run dev          # http://localhost:8080, rebuilds on save
```

On port 8080 the page talks to a local coach on `127.0.0.1:8100`:

```bash
cd coach && ANTHROPIC_API_KEY=... python coach_server.py serve
```

To try a real project, run the helper in it: `python rgg_server.py --class-code CODE`.

## Test

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js     # web app, once
npm test                                                         # web app, watching
npx svelte-check                                                 # Svelte components
python3 -m unittest discover -s test -p "test_rgg_server.py"     # the helper
(cd coach && python -m unittest test_coach_server test_coach)    # the coach (pip install -r coach/requirements.txt)
python coach/run_fixtures.py                                     # the coach's answers (calls the model)
```

## Release

`npm run deploy:all` (`./release.sh`; add `--pwd` to type the server's sudo password) ships
everything from a clean `main`. It runs the tests, pushes, deploys the coach
([deploy.sh](deploy.sh)), then builds the web app and publishes it to GitHub Pages (`docs/`).
The coach goes first, so a new web app never talks to an old coach.

Just the web app (GitHub Pages): `npm run deploy:web`. Just the coach (compucore3): `npm run deploy:coach` (`./deploy.sh`).

A new `rgg_server.py` reaches students only when they download it again, or when a CMake
exercise fetches it on configure (see [AUTHORING.md](AUTHORING.md)). A running helper keeps
its old code until it's restarted.
