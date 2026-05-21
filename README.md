# Smart Home Platform Monorepo

Clean monorepo for the Smart Home MVP. This repository combines:

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

## Notes

- Public backend contracts remain under `/api`.
- Error shape remains `{ "error": "...", "message": "..." }`.
- `ml` contains reusable ML code, while backend keeps database access and HTTP orchestration.
- Generated environments and caches are intentionally excluded from version control.
