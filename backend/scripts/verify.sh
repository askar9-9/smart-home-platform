#!/usr/bin/env sh
set -eu

. "$(CDPATH= cd -- "$(dirname "$0")" && pwd)/_env.sh"

cd "$MONOREPO_ROOT"
"$PYTHON_BIN" -m compileall backend/app backend/tests ml/src
"$PYTEST_BIN" -q backend/tests

if [ "${RUN_DOCKER_SMOKE:-0}" = "1" ]; then
  docker compose up --build -d
  "$BACKEND_DIR/scripts/smoke.sh"
fi
