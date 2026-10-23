#!/bin/bash

# Ships everything but the push: tests, the coach server, then the web app's build.
#
# Usage: ./release.sh [--pwd]      (or: npm run release)
#   --pwd   ask for the sudo password here (passed on to deploy.sh)
#
#   1. checks the working tree is committed (deploy.sh ships HEAD only)
#   2. runs the JS tests and the coach's Python tests
#   3. deploys the coach to the server (deploy.sh --yes): first, so a new web
#      app never talks to an old coach
#   4. builds the web app into docs/ and commits it
#
# It never pushes: GitHub Pages serves the new web app once you `git push`.
# Stops at the first failure; nothing later runs.

set -e
cd "$(dirname "$0")"

DEPLOY_ARGS=(--yes)
for arg in "$@"; do
    case "$arg" in
        --pwd) DEPLOY_ARGS+=(--pwd) ;;
        -h|--help) sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown option: $arg (see --help)"; exit 1 ;;
    esac
done

echo "[1/4] Checking everything is committed..."
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

echo "[2/4] Running the tests..."
node --experimental-vm-modules node_modules/jest/bin/jest.js --silent
(cd coach && if python3 -c "import anthropic" 2>/dev/null; then
    python3 -m unittest -q test_coach test_coach_server
else
    echo "  (anthropic isn't installed here: skipping test_coach_server)"
    python3 -m unittest -q test_coach
fi)

echo "[3/4] Deploying the coach..."
./deploy.sh "${DEPLOY_ARGS[@]}"

echo "[4/4] Building the web app into docs/..."
npm run build
cp -a public/. docs
git add docs
if git diff --cached --quiet -- docs; then
    echo "  docs/ unchanged: nothing to commit."
else
    git commit -m "Deploying to Github Pages"
fi

echo ""
echo "Coach deployed at $(git rev-parse --short HEAD). The web app goes live on GitHub Pages when you push:"
echo "    git push"
