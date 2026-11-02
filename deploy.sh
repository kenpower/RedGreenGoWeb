#!/bin/bash

# Deploys the coach proxy (coach/) to compucore3.
# The web app itself is still published to GitHub Pages with `npm run publish`.
#
# Usage: ./deploy.sh [--yes] [--pwd] [--copy-key]
#   --yes       don't ask "Deploy?"
#   --pwd       ask for the sudo password here (hidden) before connecting
#   --copy-key  install your SSH key on the server, then stop
#
# Settings and secrets come from .env.deploy (copy .env.deploy.example).
# With SUDO_PASSWORD in .env.deploy, or --pwd, the password goes to the server
# on ssh's stdin (never a command line or a file), so `./deploy.sh --yes` with
# SUDO_PASSWORD set asks nothing.
# The same command does the first deploy and every later one: it creates the
# service user, venv, systemd unit and nginx config if they are missing, and
# replaces the code, API key and config files every time. The class-code
# database (/var/lib/<app>/coach.sqlite3) is never touched.
#
# Only committed files are deployed (git archive HEAD).
#
# Opens two SSH connections (upload, install). Without a sudo password from
# .env.deploy or --pwd, sudo asks for it once on the server. Run with
# --copy-key first to stop SSH asking for a password.

set -e

STAGE=""

pause_on_error() {
    status=$?
    if [ -n "$STAGE" ]; then
        rm -rf "$STAGE"
    fi
    if [ "$status" -ne 0 ]; then
        echo ""
        echo "============================================"
        echo "DEPLOYMENT FAILED (exit code: $status)"
        echo "============================================"
        echo ""
        read -r -p "Press Enter to close..."
    fi
}
trap pause_on_error EXIT

ASSUME_YES=false
ASK_PWD=false
COPY_KEY=false
for arg in "$@"; do
    case "$arg" in
        --yes|-y) ASSUME_YES=true ;;
        --pwd) ASK_PWD=true ;;
        --copy-key) COPY_KEY=true ;;
        -h|--help)
            sed -n '3,24p' "$0" | sed 's/^# \{0,1\}//'
            exit 0 ;;
        *) echo "Unknown option: $arg (see --help)"; exit 1 ;;
    esac
done

cd "$(dirname "$0")"

ENV_FILE=".env.deploy"
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found. Create it with: cp .env.deploy.example $ENV_FILE"
    exit 1
fi
source "$ENV_FILE"

APP_NAME=${APP_NAME:-rgg-coach}
INSTALL_DIR=${INSTALL_DIR:-/opt/$APP_NAME}
URL_PATH=${URL_PATH:-/rgg-coach}
PORT=${PORT:-8100}
RATE_PER_MINUTE=${RATE_PER_MINUTE:-20}

for var in DEPLOY_HOST DEPLOY_USER ANTHROPIC_API_KEY; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set in $ENV_FILE"
        exit 1
    fi
done
if [[ "$ANTHROPIC_API_KEY" != sk-ant-* ]]; then
    echo "Error: ANTHROPIC_API_KEY in $ENV_FILE doesn't look like an Anthropic key (sk-ant-...)"
    exit 1
fi

SSH_OPTS=()
if [ -n "$SSH_KEY" ]; then
    SSH_OPTS=(-i "$SSH_KEY")
fi
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

if [ "$COPY_KEY" == "true" ]; then
    PUB="${SSH_KEY:-$HOME/.ssh/id_ed25519}.pub"
    if [ ! -f "$PUB" ]; then
        echo "No public key at $PUB. Make one with: ssh-keygen -t ed25519 -f ${PUB%.pub} -N \"\""
        exit 1
    fi
    echo "Adding $PUB to ${REMOTE}:~/.ssh/authorized_keys (enter your password)..."
    ssh "${SSH_OPTS[@]}" "$REMOTE" "umask 077 && mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys" < "$PUB"
    echo "Done. SSH should no longer ask for a password."
    exit 0
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMMIT=$(git rev-parse --short HEAD)

echo "============================================"
echo "Deployment Configuration"
echo "============================================"
echo "Host:        ${DEPLOY_HOST}"
echo "User:        ${DEPLOY_USER}"
echo "App name:    ${APP_NAME}"
echo "Install dir: ${INSTALL_DIR}"
echo "URL:         https://${DEPLOY_HOST}${URL_PATH}/"
echo "Local port:  ${PORT}"
echo "Commit:      ${COMMIT}"
echo "============================================"
echo ""

echo "Running git safety checks..."
GIT_WARNINGS=0
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "WARNING: You are deploying from branch '${CURRENT_BRANCH}', not main/master."
    GIT_WARNINGS=$((GIT_WARNINGS + 1))
fi
UNCOMMITTED=$(git status --porcelain -- coach)
if [ -n "$UNCOMMITTED" ]; then
    echo "WARNING: Uncommitted changes in coach/ will NOT be deployed:"
    echo "$UNCOMMITTED" | sed 's/^/    /'
    GIT_WARNINGS=$((GIT_WARNINGS + 1))
fi
UNPUSHED=$(git log @{u}.. --oneline 2>/dev/null || true)
if [ -n "$UNPUSHED" ]; then
    echo "WARNING: You have unpushed commits:"
    echo "$UNPUSHED" | sed 's/^/    /'
    GIT_WARNINGS=$((GIT_WARNINGS + 1))
fi
if [ "$GIT_WARNINGS" -eq 0 ]; then
    echo "  All git checks passed."
fi
echo ""

if [ "$ASSUME_YES" != "true" ]; then
    read -p "Deploy ${COMMIT} to ${DEPLOY_HOST}? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# Never exported, so it isn't in any child process's environment.
SUDO_PASSWORD=${SUDO_PASSWORD:-}
if [ "$ASK_PWD" == "true" ]; then
    read -r -s -p "sudo password for ${REMOTE}: " SUDO_PASSWORD
    echo
fi

# Step 1: Stage the bundle. It holds the API key, so it lives in a private temp
# dir that pause_on_error removes however the script exits.
echo "[1/3] Building deploy bundle..."
STAGE=$(mktemp -d)
mkdir -p "$STAGE/bundle/app"
git archive HEAD coach | tar -x -C "$STAGE/bundle/app"
echo "$COMMIT" > "$STAGE/bundle/app/DEPLOYED_COMMIT"

render() {
    sed \
        -e "s#__APP_NAME__#${APP_NAME}#g" \
        -e "s#__INSTALL_DIR__#${INSTALL_DIR}#g" \
        -e "s#__URL_PATH__#${URL_PATH}#g" \
        -e "s#__PORT__#${PORT}#g" \
        -e "s#__RATE_PER_MINUTE__#${RATE_PER_MINUTE}#g" \
        "$1" > "$2"
}
render coach/deploy/nginx.conf.template "$STAGE/bundle/nginx.conf"
render coach/deploy/nginx-ratelimit.conf.template "$STAGE/bundle/nginx-ratelimit.conf"
render coach/deploy/rgg-coach.service.template "$STAGE/bundle/service"
render coach/deploy/admin.sh.template "$STAGE/bundle/admin"
cp coach/deploy/remote_install.sh "$STAGE/bundle/install.sh"

(
    umask 077
    {
        echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
        echo "RGG_COACH_DB=/var/lib/${APP_NAME}/coach.sqlite3"
        echo "RGG_COACH_PORT=${PORT}"
    } > "$STAGE/bundle/coach.env"
    {
        echo "APP_NAME='${APP_NAME}'"
        echo "INSTALL_DIR='${INSTALL_DIR}'"
        echo "PORT='${PORT}'"
        echo "COMMIT='${COMMIT}'"
    } > "$STAGE/bundle/deploy.vars"
)

BUNDLE_NAME="${APP_NAME}_deploy_${TIMESTAMP}"
tar --force-local -czf "$STAGE/bundle.tar.gz" -C "$STAGE" --transform "s#^bundle#${BUNDLE_NAME}#" bundle

# Step 2: Upload over stdin into a file only ken can read (it contains the key).
echo "[2/3] Uploading bundle to ${REMOTE}..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "umask 077 && cat > ~/${BUNDLE_NAME}.tar.gz" < "$STAGE/bundle.tar.gz"

# Step 3: Unpack and install in a single session so sudo asks only once.
INSTALL_CMD="set -e; umask 077; cd ~ && \
    trap 'rm -rf ~/${BUNDLE_NAME} ~/${BUNDLE_NAME}.tar.gz' EXIT && \
    tar -xzf ${BUNDLE_NAME}.tar.gz && \
    bash ${BUNDLE_NAME}/install.sh ~/${BUNDLE_NAME}"
if [ -n "$SUDO_PASSWORD" ]; then
    # printf is a bash builtin, so the password is in no process's argv. No -t:
    # a terminal would echo what arrives on stdin.
    echo "[3/3] Installing on ${DEPLOY_HOST}..."
    printf '%s\n' "$SUDO_PASSWORD" | ssh "${SSH_OPTS[@]}" "$REMOTE" "$INSTALL_CMD --sudo-password-on-stdin"
else
    echo "[3/3] Installing on ${DEPLOY_HOST} (sudo may ask for your password)..."
    ssh -t "${SSH_OPTS[@]}" "$REMOTE" "$INSTALL_CMD"
fi

echo ""
echo "============================================"
echo "Deployment completed successfully!"
echo "============================================"
echo "Coach:  https://${DEPLOY_HOST}${URL_PATH}/health"
echo "Admin:  ssh -t ${REMOTE} ${APP_NAME}-admin classes"
echo ""
