# homeIQ Monorepo

Clean monorepo for the homeIQ MVP. This repository combines:

- `backend`: FastAPI + PostgreSQL backend with seed data, automations, events, energy endpoints, and integration tests.
- `frontend`: React + Vite + TypeScript client for the MVP flows.
- `ml`: reusable ML feature extraction and model-loading package used by backend energy anomaly flows.

## Project Layout

```text
smart-home-platform/
  backend/
  frontend/
  ml/
  docs/
  docker-compose.yml
```

## Quick Start

From the monorepo root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8080/api`
- Swagger: `http://localhost:8080/docs`

Demo credentials:

```text
testadmin / testpass123
```

## Local Development

Backend:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Frontend:

```bash
cd frontend
npm install
```

Verification:

```bash
backend/scripts/verify.sh
cd frontend && npm test && npm run build
```

## Local Backend With Docker Infra

Supported local backend workflow:

```bash
docker compose up -d postgres mosquitto
cp backend/.env.local.example backend/.env
cd backend && ./scripts/dev.sh
```

Checks:

```bash
curl http://localhost:8080/api/health
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"testadmin","password":"testpass123"}'
```

This path is the supported local backend setup. It relies on Docker for PostgreSQL and Mosquitto, while the FastAPI app runs from your local Python environment.

## Notes

- Public backend contracts remain under `/api`.
- Error shape remains `{ "error": "...", "message": "..." }`.
- `ml` contains reusable ML code, while backend keeps database access and HTTP orchestration.
- Generated environments and caches are intentionally excluded from version control.
