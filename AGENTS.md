# Smart Home Platform — Monorepo Agent Notes

Monorepo for the Smart Home MVP: FastAPI + PostgreSQL backend, React + Vite + TypeScript frontend, reusable ML module.

## Repository Layout

```text
smart-home-platform/
  backend/            # FastAPI API, persistence, automations, energy, ML orchestration
  frontend/           # React SPA consuming the /api contract
  ml/                 # Reusable ML: feature extraction, model artifacts, anomaly scoring
  docs/               # Architecture and API contract documentation
  docker-compose.yml  # Full-stack Docker orchestration
```

## Architecture

```text
Frontend → /api → Routers → Services → Models → PostgreSQL
                      ↘ Services/ml.py → ml package
```

- **Backend** owns HTTP, database, auth, SSE, and orchestrates domain workflows.
- **Frontend** consumes the stable `/api` contract via JWT-authenticated requests and SSE for realtime events.
- **ML package** is framework-light and reusable — no database access, no HTTP errors, no FastAPI imports. Backend calls into it via `app/services/ml.py`.

## Module Docs

Each subproject has its own AGENTS.md with structure, verification, and safety rules:

- **[backend/AGENTS.md](backend/AGENTS.md)** — routers, services, models, core, local verification, safety
- **[frontend/AGENTS.md](frontend/AGENTS.md)** — api, auth, components, pages, features, local verification, safety
- **[ml/AGENTS.md](ml/AGENTS.md)** — features, model, artifacts, boundary rules, safety

## Agent Workflow

Use a small, controlled agent workflow. Do not split work into many specialized agents unless the task explicitly requires it.

Default workflow:

```text
Plan → Build → Review → Fix → Summarize
```

### 1. Plan

Before editing files, inspect the existing implementation and identify:

- which subprojects are affected: `backend`, `frontend`, `ml`, or `docs`
- whether the change touches the public `/api` contract
- whether DTOs, frontend types, or ML boundaries need updates
- which tests or verification commands should be run
- the smallest safe implementation step

Planning must not rewrite architecture or propose microservices unless explicitly requested.

### 2. Build

Implement focused changes only.

Rules:

- Prefer small, reviewable diffs.
- Do not rewrite unrelated modules.
- Keep backend, frontend, and ML boundaries intact.
- If backend DTOs change, update frontend API/types and docs.
- If frontend assumptions change, verify they match backend responses.
- If ML behavior changes, keep the ML package framework-light and call it only through `backend/app/services/ml.py`.
- Preserve existing MVP/demo behavior unless the task explicitly changes it.

### 3. Review

Review changes before considering the task complete.

The review must check:

- API contract compatibility
- frontend/backend type consistency
- ML package boundary violations
- auth, SSE, automations, integrations, and energy endpoint compatibility
- tests and build status
- unnecessary rewrites or overengineering
- accidental commits of generated files, secrets, caches, or local artifacts

### 4. Fix

If review finds blocking issues, fix only those issues. Avoid broad refactors during the fix step.

### 5. Summarize

At the end of each task, provide:

- changed files
- what was implemented
- verification commands run
- remaining risks or follow-up work

## API Contract

Full contract: [docs/api-contract.md](docs/api-contract.md)

Key rules:

- Base URL: `/api`
- All endpoints except `GET /health` and `POST /auth/login` require `Authorization: Bearer <jwt>`
- Error shape: `{ "error": "...", "message": "..." }`
- SSE uses `?token=...` for browser EventSource compatibility

## Environment & Docker

From monorepo root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8080/api`
- Swagger: `http://localhost:8080/docs`

Demo credentials: `testadmin / testpass123`

Backend env (see `backend/.env.example`): `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRES_SECONDS`, `CORS_ORIGINS`, `SEED_ENABLED`, `SIM_ENABLED`

Frontend env (see `frontend/.env.example`): `VITE_API_BASE_URL` (default: `http://localhost:8080/api`)

## Local Verification

Backend:

```bash
backend/scripts/verify.sh
```

Frontend:

```bash
cd frontend && npm test && npm run build
```

Full stack:

```bash
docker compose up --build
```

## Cross-Cutting Rules

- Keep the public `/api/...` contract stable unless a task explicitly asks for a breaking change.
- Do not commit `.venv`, `.env`, `node_modules`, `dist`, coverage, caches, or generated artifacts.
- The ML package must not import backend modules. Backend calls ML via `app/services/ml.py`.
- Frontend must not invent data contracts that diverge from backend DTOs.
- Preserve SSE, automations, integrations, and energy endpoint compatibility.
- Fix type drift at the source rather than weakening types globally.
