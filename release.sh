#!/bin/bash

# Ships everything in one go: tests, push, the coach server, then the web app.
#
# Usage: ./release.sh [--pwd]      (or: npm run release)
#   --pwd   ask for the sudo password here (passed on to deploy.sh)
#
#   1. checks the working tree is committed (deploy.sh ships HEAD only)
#   2. runs the JS tests and the coach's Python tests
#   3. pushes main
#   4. deploys the coach to the server (deploy.sh --yes): first, so a new web
#      app never talks to an old coach
#   5. builds the web app and publishes it to GitHub Pages (docs/)
#
# Stops at the first failure; nothing later runs.

set -e
cd "$(dirname "$0")"

DEPLOY_ARGS=(--yes)
for arg in "$@"; do
    case "$arg" in
        --pwd) DEPLOY_ARGS+=(--pwd) ;;
        -h|--help) sed -n '3,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown option: $arg (see --help)"; exit 1 ;;
    esac
done

echo "[1/5] Checking everything is committed..."
DIRTY=$(git status --porcelain -- . ':!docs')
if [ -n "$DIRTY" ]; then
    echo "Commit (or stash) these first:"
    echo "$DIRTY" | sed 's/^/    /'
    exit 1
fi
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo "On branch '$BRANCH': release from main."
    exit 1
fi

echo "[2/5] Running the tests..."
node --experimental-vm-modules node_modules/jest/bin/jest.js --silent
(cd coach && if python3 -c "import anthropic" 2>/dev/null; then
    python3 -m unittest -q test_coach test_coach_server
else
    echo "  (anthropic isn't installed here: skipping test_coach_server)"
    python3 -m unittest -q test_coach
fi)

echo "[3/5] Pushing main..."
git push

echo "[4/5] Deploying the coach..."
bash ./deploy.sh "${DEPLOY_ARGS[@]}"  # through bash: deploy.sh isn't executable on every checkout

echo "[5/5] Publishing the web app to GitHub Pages..."
npm run build
cp -a public/. docs
git add docs
if git diff --cached --quiet -- docs; then
    echo "  docs/ unchanged: nothing to publish."
else
    git commit -m "Deploying to Github Pages"
    git push
fi

echo ""
echo "Released $(git rev-parse --short HEAD): coach deployed, web app published."
