# Deploying the coach proxy on compucore3

One-time setup on the server (Ubuntu, nginx already running):

```bash
sudo useradd --system --home /opt/rgg-coach rgg-coach
sudo mkdir -p /opt/rgg-coach && sudo chown rgg-coach: /opt/rgg-coach
sudo -u rgg-coach git clone https://github.com/kenpower/RedGreenGoWeb /opt/rgg-coach/RedGreenGoWeb
sudo -u rgg-coach python3 -m venv /opt/rgg-coach/venv
sudo -u rgg-coach /opt/rgg-coach/venv/bin/pip install anthropic

# API key, readable by root only (systemd reads it before dropping to rgg-coach)
echo 'ANTHROPIC_API_KEY=sk-ant-...' | sudo tee /etc/rgg-coach.env >/dev/null
sudo chmod 600 /etc/rgg-coach.env

sudo cp /opt/rgg-coach/RedGreenGoWeb/coach/deploy/rgg-coach.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now rgg-coach
```

Then add `nginx-location.conf` to the site's `server { }` block (and the
`limit_req_zone` line to `http { }`), and `sudo nginx -t && sudo systemctl reload nginx`.

Check it: `curl https://compucore3.setu.ie/rgg-coach/health`.

## Classes

```bash
cd /opt/rgg-coach/RedGreenGoWeb/coach
sudo -u rgg-coach /opt/rgg-coach/venv/bin/python coach_server.py add-class SD2-2026 "Software Dev 2, 2026"
sudo -u rgg-coach /opt/rgg-coach/venv/bin/python coach_server.py classes
sudo -u rgg-coach /opt/rgg-coach/venv/bin/python coach_server.py usage
```

## Updating

```bash
sudo -u rgg-coach git -C /opt/rgg-coach/RedGreenGoWeb pull
sudo systemctl restart rgg-coach
```

Run `coach/run_fixtures.py` before pushing any change to `coach/prompt.md` or a kata pack.
