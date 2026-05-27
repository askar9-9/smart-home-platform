#!/usr/bin/env sh
set -eu

. "$(CDPATH= cd -- "$(dirname "$0")" && pwd)/_env.sh"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "Missing backend/.env. Copy backend/.env.local.example to backend/.env before starting the local backend." >&2
  exit 1
fi

check_port() {
  host="$1"
  port="$2"
  name="$3"

  if ! "$PYTHON_BIN" - "$host" "$port" <<'PY'
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.settimeout(1)
    sock.connect((host, port))
PY
  then
    echo "$name is unavailable at $host:$port." >&2
    echo "Start local infra first: docker compose up -d postgres mosquitto" >&2
    exit 1
  fi
}

check_port "127.0.0.1" "5432" "PostgreSQL"
check_port "127.0.0.1" "1883" "Mosquitto"

cd "$BACKEND_DIR"
"$PYTHON_BIN" -m alembic upgrade head
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port 8080
