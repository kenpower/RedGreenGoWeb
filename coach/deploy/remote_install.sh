#!/bin/bash
# Runs on the server, from deploy.sh: bash install.sh <unpacked bundle dir>
# Safe to run on a fresh machine and on every later deploy.

set -euo pipefail

BUNDLE=$1
source "$BUNDLE/deploy.vars"

STATE_DIR=/var/lib/${APP_NAME}
NGINX_SITE=/etc/nginx/sites-enabled/${APP_NAME}.conf
NGINX_ZONE=/etc/nginx/conf.d/${APP_NAME}-ratelimit.conf

sudo -v

# First deploy only: service user, python venv support, install dir
if ! id "$APP_NAME" >/dev/null 2>&1; then
    echo "  Creating system user ${APP_NAME}..."
    sudo useradd --system --home-dir "$INSTALL_DIR" --no-create-home --shell /usr/sbin/nologin "$APP_NAME"
fi
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
    echo "  Installing python3-venv..."
    sudo apt-get install -y python3-venv
fi
sudo mkdir -p "$INSTALL_DIR"
if [ ! -x "$INSTALL_DIR/venv/bin/python" ]; then
    echo "  Creating venv in ${INSTALL_DIR}/venv..."
    sudo python3 -m venv "$INSTALL_DIR/venv"
fi

# Code: copy in beside the live release, then swap. The previous release is
# kept as app.previous for a quick manual rollback.
echo "  Installing code (${COMMIT})..."
sudo rm -rf "$INSTALL_DIR/app.new"
sudo cp -r "$BUNDLE/app" "$INSTALL_DIR/app.new"
sudo chown -R root:root "$INSTALL_DIR/app.new"
sudo chmod -R u=rwX,go=rX "$INSTALL_DIR/app.new"
sudo "$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade -r "$INSTALL_DIR/app.new/coach/requirements.txt"
if [ -d "$INSTALL_DIR/app" ]; then
    sudo rm -rf "$INSTALL_DIR/app.previous"
    sudo mv "$INSTALL_DIR/app" "$INSTALL_DIR/app.previous"
fi
sudo mv "$INSTALL_DIR/app.new" "$INSTALL_DIR/app"

# Secrets and settings, root-only; systemd reads them before dropping privileges
sudo install -m 600 -o root -g root "$BUNDLE/coach.env" "/etc/${APP_NAME}.env"

# Carry over a database from the old git-clone install (coach/deploy/README.md)
OLD_DB="$INSTALL_DIR/RedGreenGoWeb/coach/coach.sqlite3"
if [ -f "$OLD_DB" ] && ! sudo test -f "$STATE_DIR/coach.sqlite3"; then
    echo "  Moving existing database from ${OLD_DB}..."
    sudo systemctl stop "$APP_NAME" 2>/dev/null || true
    sudo install -d -m 755 -o "$APP_NAME" -g "$APP_NAME" "$STATE_DIR"
    sudo install -m 644 -o "$APP_NAME" -g "$APP_NAME" "$OLD_DB" "$STATE_DIR/coach.sqlite3"
fi

sudo install -m 755 -o root -g root "$BUNDLE/admin" "/usr/local/bin/${APP_NAME}-admin"

echo "  Installing and restarting ${APP_NAME}.service..."
sudo install -m 644 -o root -g root "$BUNDLE/service" "/etc/systemd/system/${APP_NAME}.service"
sudo systemctl daemon-reload
sudo systemctl enable --quiet "$APP_NAME"
sudo systemctl restart "$APP_NAME"

echo "  Waiting for the coach to answer on port ${PORT}..."
for i in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
        echo "  Coach is up."
        break
    fi
    if [ "$i" -eq 20 ]; then
        echo "ERROR: coach did not answer on 127.0.0.1:${PORT}/health. Recent log:"
        sudo journalctl -u "$APP_NAME" -n 30 --no-pager
        exit 1
    fi
    sleep 1
done

# nginx: the location block goes in sites-enabled (same as the other apps on this
# server), the rate-limit zone in conf.d (it must be in http { }). If nginx -t
# fails, the previous files are put back so the other sites keep working.
echo "  Installing nginx config..."
sudo cp "$BUNDLE/nginx.conf" "$INSTALL_DIR/nginx.conf"
BACKUP=$INSTALL_DIR/nginx-backup
sudo rm -rf "$BACKUP" && sudo mkdir -p "$BACKUP"
for f in "$NGINX_SITE" "$NGINX_ZONE"; do
    if [ -f "$f" ]; then sudo cp "$f" "$BACKUP/"; fi
done
sudo install -m 644 -o root -g root "$BUNDLE/nginx.conf" "$NGINX_SITE"
sudo install -m 644 -o root -g root "$BUNDLE/nginx-ratelimit.conf" "$NGINX_ZONE"
if ! sudo nginx -t; then
    echo "ERROR: nginx -t failed; restoring the previous nginx config."
    for f in "$NGINX_SITE" "$NGINX_ZONE"; do
        if [ -f "$BACKUP/$(basename "$f")" ]; then sudo cp "$BACKUP/$(basename "$f")" "$f"; else sudo rm -f "$f"; fi
    done
    exit 1
fi
sudo systemctl reload nginx
echo "  nginx reloaded."
