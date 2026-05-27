#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

docker compose up --build -d
./backend/scripts/smoke.sh

cd "$REPO_ROOT/frontend"
node ./node_modules/playwright/cli.js test
