# homeIQ Backend

Backend application for the homeIQ monorepo.

## Docker Compose

From the monorepo root:

```bash
docker compose up --build
```

API: `http://localhost:8080/api`  
Swagger: `http://localhost:8080/docs`

## Local Backend With Docker Infra

This is the supported local backend workflow. PostgreSQL and Mosquitto run in Docker, while FastAPI runs from your local Python environment.

### 1. Install Python dependencies

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

### 2. Start infrastructure

From the monorepo root:

```bash
docker compose up -d postgres mosquitto
```

### 3. Create the local backend env file

From the monorepo root:

```bash
cp backend/.env.local.example backend/.env
```

- `backend/.env.example` is for the docker-compose backend container and points to `postgres` / `mosquitto`.
- `backend/.env.local.example` is for local backend execution and points to `127.0.0.1`.

### 4. Start the backend

```bash
cd backend && ./scripts/dev.sh
```

`dev.sh` checks that PostgreSQL (`127.0.0.1:5432`) and Mosquitto (`127.0.0.1:1883`) are reachable, runs `alembic upgrade head`, then starts `uvicorn` on `127.0.0.1:8080`.

### 5. Verify auth

```bash
curl http://localhost:8080/api/health
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"testadmin","password":"testpass123"}'
```

Demo credentials: `testadmin / testpass123`

## Local Verification

From the monorepo root:

```bash
backend/scripts/verify.sh
```

## Notes

- Public API paths remain under `/api`.
- Error responses remain `{ "error": "...", "message": "..." }`.
- The supported local backend path requires Docker infra; host-only PostgreSQL or Mosquitto is not documented as a supported workflow.
