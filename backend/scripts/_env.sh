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

export BACKEND_DIR
export MONOREPO_ROOT
export PYTHON_BIN
export PYTEST_BIN
export PYTHONPATH="$BACKEND_DIR:$MONOREPO_ROOT/ml/src${PYTHONPATH:+:$PYTHONPATH}"
