# Deploying the coach proxy on compucore3

From the repo root, in Git Bash:

```bash
cp .env.deploy.example .env.deploy   # then fill in ANTHROPIC_API_KEY
./deploy.sh --copy-key               # once: install your SSH key so ssh stops asking for a password
./deploy.sh                          # first deploy and every later one
./deploy.sh --yes --pwd              # no "Deploy?" question; type the sudo password once, hidden
```

To deploy without being asked anything, put `SUDO_PASSWORD=...` in `.env.deploy` (git-ignored)
and run `./deploy.sh --yes`. `--pwd` asks for the password locally instead, and overrides the
file. Either way the password goes to the server on ssh's stdin and sudo reads it with
`sudo -S`. It never appears on a command line, in the uploaded bundle, in a file on the server
or in the output. Without either, sudo asks for it on the server, as before. If sudo on the
server doesn't keep the password between commands, the install stops and says so; deploy
without the password then.

`deploy.sh` packs the committed `coach/` (git archive HEAD),
uploads them and runs `remote_install.sh` on the server, which:

- first time only: creates the `rgg-coach` system user and `/opt/rgg-coach/venv`
- installs the code into `/opt/rgg-coach/app` (the previous one stays in `app.previous`) and runs `pip install -r coach/requirements.txt`
- writes `/etc/rgg-coach.env` (API key, DB path, port; root-only, chmod 600)
- installs and restarts `rgg-coach.service`, then checks `http://127.0.0.1:8100/health`
- renders `nginx.conf.template` into `/etc/nginx/sites-enabled/rgg-coach.conf` and the
  rate-limit zone into `/etc/nginx/conf.d/rgg-coach-ratelimit.conf`, runs `nginx -t`
  (and puts the old files back if that fails), then reloads nginx

The class-code database is at `/var/lib/rgg-coach/coach.sqlite3`. Deploys never touch it.

Check it: `curl https://compucore3.setu.ie/rgg-coach/health`.

The coach accepts requests from the game on GitHub Pages, from the dev server
(`http://localhost:8080`) and from the game page served by a student's own helper
(`http://127.0.0.1:8000` or `http://localhost:8000`; `rgg_server.py` serves it so Chrome lets the
page reach the helper). The helper origins can use `/coach`, `/progress` and `/class` but not `/teacher/...`.

The game won't start without a valid class code. It checks the code first with
`GET /class?code=CODE`, which answers `{"ok": true, "name": "..."}` for an active class and
404 `{"ok": false}` for an unknown or disabled one. The check doesn't use up the class's
allowance. It shares the students' per-IP nginx rate limit, which also stops anyone trying
codes one after another.

## Classes

```bash
# single quotes round the remote command, or ssh drops the inner quotes
ssh -t ken@compucore3.setu.ie 'rgg-coach-admin add-class SD2-2026 "Software Dev 2, 2026"'
ssh -t ken@compucore3.setu.ie rgg-coach-admin classes
ssh -t ken@compucore3.setu.ie rgg-coach-admin usage      # orient / look / rescue: how many of the requests were each kind
```

Each class gets 600 requests and 2,000,000 tokens a day by default (uncached input + cache
writes + output; cache reads aren't counted). Whichever runs out first stops coaching until
midnight. Change them with `add-class CODE "Name" --limit 800 --tokens 3000000`; re-running
`add-class` for an existing code updates it.

## Pair progress (for grading)

```bash
ssh -t ken@compucore3.setu.ie rgg-coach-admin progress SD2-2026            # table
ssh -t ken@compucore3.setu.ie rgg-coach-admin progress SD2-2026 --days 7   # only games active this week
# CSV: write it on the server (sudo needs the terminal for its password), then copy it back
ssh -t ken@compucore3.setu.ie 'rgg-coach-admin progress SD2-2026 --csv > sd2.csv' && scp ken@compucore3.setu.ie:sd2.csv .
ssh -t ken@compucore3.setu.ie rgg-coach-admin clear-progress SD2-2026      # asks first; --yes skips that
```

`progress` gives one row per pair, adding up all their games. A pair is the two names as
typed on the start screen, lowercased. "jane" + "john" and "john" + "jane" count as one pair,
shown with the most recent spelling. A typo in a name makes a separate pair. Leave out the
class code to list every class.

| column | meaning | source |
|---|---|---|
| games | games started with this class code | browser |
| last active | last update from any of their games | server clock |
| steps, cycles | Done clicks that moved on; Red-Green-Refactor rounds | browser |
| overr | times they pressed "Progress despite this advice" | browser |
| rescue | times they asked "Show me the code" after being held 3 times on one step; a pair that keeps needing it is worth a visit | browser |
| kept | Red tests that passed straight away and that they chose to keep (skipping Green) | browser |
| asks | steps the coach judged | **server** |
| 1st ok | % of those the coach let through at once (advance / asks) | **server** |
| holds | times the coach said redo or back to Red | **server** |
| finished (coach agreed) | games they marked finished (of which the coach agreed) | browser (**server**) |

The **server** counts come from the coach's own verdicts and can be trusted. The browser
counts are whatever the game sends to `POST /progress`. They are fine for spotting who is
working and who is stuck, but a student who knows the class code could send made-up numbers.
Only games played with a class code are recorded.

`clear-progress` also deletes the class's event timelines. It keeps the grades.

## Teacher view (live class view, timelines, rubric grades)

```bash
ssh -t ken@compucore3.setu.ie rgg-coach-admin teacher-link SD2-2026            # prints the secret link
ssh -t ken@compucore3.setu.ie rgg-coach-admin teacher-link SD2-2026 --rotate   # new key; the old link stops working
```

The link (`https://kenpower.github.io/RedGreenGoWeb/?teacher=CODE&key=KEY`) opens the live
class view: one tile per pair, refreshed every 15 seconds, with stuck pairs flagged. Click a
pair for its timeline and the rubric. Anyone with the link can see the class and change grades,
so keep it to yourself. Use `--rotate` if it leaks. It works even for a disabled class.

Each class starts with the default rubric (TDD discipline, Test quality, Refactoring,
Collaboration, Small commits), scored 0-4 with a comment. You can change it in the teacher view.

```bash
ssh -t ken@compucore3.setu.ie rgg-coach-admin grades SD2-2026        # one row per pair
ssh -t ken@compucore3.setu.ie 'rgg-coach-admin grades SD2-2026 --csv > sd2-grades.csv' && scp ken@compucore3.setu.ie:sd2-grades.csv .
ssh -t ken@compucore3.setu.ie rgg-coach-admin clear-grades SD2-2026  # asks first; --yes skips that
```

The teacher endpoints (`/teacher/...`) have their own nginx rate limit of 60 requests a minute
per IP. Students' requests from the same classroom IP don't use it up.

### Privacy: tell the students

With the teacher view, the server stores more than counts. For each game played with a class
code it keeps:

- the pair's names as typed on the start screen
- the coach's notes and the rule findings shown to them
- what they said the next test would check, and their predictions
- the names of their tests when they finish, and their git commit messages
- the time of each step
- the coach's one-line summary of what the pair is building (from Orient), and any problem
  text they type to correct it
- the IP address each game last reported from (shown on the pair's tile, to find the PC)

It stores **no code**. Students must be told this before they use a class code. Delete it
with `clear-progress` (and grades with `clear-grades`) when the module is over.

## Rollback

```bash
sudo mv /opt/rgg-coach/app /opt/rgg-coach/app.bad && sudo mv /opt/rgg-coach/app.previous /opt/rgg-coach/app
sudo systemctl restart rgg-coach
```

Run `coach/run_fixtures.py` before you deploy any change to `coach/prompt.md` or `coach/coach.py`.
