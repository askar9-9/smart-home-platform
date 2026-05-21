# Backend Agent Notes

This project is the Smart Home backend service.

## Scope

- Keep the public `/api/...` contract stable unless a task explicitly asks for a breaking change.
- Preserve the error response shape: `{ "error": "...", "message": "..." }`.
- Keep routers thin and place business rules in `app/services`.
- Treat PostgreSQL as the main integration target.

## Structure

- `app/routers`: HTTP layer and auth dependencies
- `app/services`: domain workflows and orchestration
- `app/models`: SQLAlchemy schema and relations
- `app/core`: auth, errors, dependencies, event bus
- `app/services/ml.py`: backend-facing ML orchestration

## Local Verification

From the monorepo root:

```bash
backend/scripts/verify.sh
```

Docker run target from monorepo root:

```bash
docker compose up --build
```

## Safety

- Do not commit `.venv`, `.env`, caches, or generated artifacts.
- Prefer changing tests together with shared backend behavior.
- Preserve SSE, automations, integrations, and energy endpoint compatibility.
