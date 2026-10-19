# Deploying the coach proxy on compucore3

From the repo root, in Git Bash:

```bash
cp .env.deploy.example .env.deploy   # then fill in ANTHROPIC_API_KEY
./deploy.sh --copy-key               # once: install your SSH key so ssh stops asking for a password
./deploy.sh                          # first deploy and every later one
```

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

## Classes

```bash
# single quotes round the remote command, or ssh drops the inner quotes
ssh -t ken@compucore3.setu.ie 'rgg-coach-admin add-class SD2-2026 "Software Dev 2, 2026"'
ssh -t ken@compucore3.setu.ie rgg-coach-admin classes
ssh -t ken@compucore3.setu.ie rgg-coach-admin usage
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
| asks | steps the coach judged | **server** |
| 1st ok | % of those the coach let through at once (advance / asks) | **server** |
| holds | times the coach said redo or back to Red | **server** |
| finished (coach agreed) | games they marked finished (of which the coach agreed) | browser (**server**) |

The **server** counts come from the coach's own verdicts and can be trusted. The browser
counts are whatever the game sends to `POST /progress`. They are fine for spotting who is
working and who is stuck, but a student who knows the class code could send made-up numbers.
Only games played with a class code are recorded.

## Rollback

```bash
sudo mv /opt/rgg-coach/app /opt/rgg-coach/app.bad && sudo mv /opt/rgg-coach/app.previous /opt/rgg-coach/app
sudo systemctl restart rgg-coach
```

Run `coach/run_fixtures.py` before you deploy any change to `coach/prompt.md` or `coach/coach.py`.
