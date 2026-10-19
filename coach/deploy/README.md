# Deploying the coach proxy on compucore3

From the repo root, in Git Bash:

```bash
cp .env.deploy.example .env.deploy   # then fill in ANTHROPIC_API_KEY
./deploy.sh --copy-key               # once: install your SSH key so ssh stops asking for a password
./deploy.sh                          # first deploy and every later one
```

`deploy.sh` packs the committed `coach/` and `src/content/katas/` (git archive HEAD),
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
ssh -t ken@compucore3.setu.ie rgg-coach-admin add-class SD2-2026 "Software Dev 2, 2026"
ssh -t ken@compucore3.setu.ie rgg-coach-admin classes
ssh -t ken@compucore3.setu.ie rgg-coach-admin usage
```

## Rollback

```bash
sudo mv /opt/rgg-coach/app /opt/rgg-coach/app.bad && sudo mv /opt/rgg-coach/app.previous /opt/rgg-coach/app
sudo systemctl restart rgg-coach
```

Run `coach/run_fixtures.py` before you deploy any change to `coach/prompt.md` or a kata pack.
