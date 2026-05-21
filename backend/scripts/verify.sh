#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
MONOREPO_ROOT="$(CDPATH= cd -- "$BACKEND_DIR/.." && pwd)"

PYTHON_BIN="${PYTHON_BIN:-$BACKEND_DIR/.venv/bin/python}"
PYTEST_BIN="${PYTEST_BIN:-$BACKEND_DIR/.venv/bin/pytest}"

if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

if [ ! -x "$PYTEST_BIN" ]; then
  PYTEST_BIN="pytest"
fi

export PYTHONPATH="$BACKEND_DIR:$MONOREPO_ROOT/ml/src${PYTHONPATH:+:$PYTHONPATH}"

cd "$MONOREPO_ROOT"
"$PYTHON_BIN" -m compileall backend/app backend/tests ml/src
"$PYTEST_BIN" -q backend/tests

if [ "${RUN_DOCKER_SMOKE:-0}" = "1" ]; then
  docker compose up --build -d
  "$BACKEND_DIR/scripts/smoke.sh"
fi
