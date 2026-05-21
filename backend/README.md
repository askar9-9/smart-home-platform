# Smart Home Backend

Backend application for the Smart Home monorepo.

## Run

From the monorepo root:

```bash
docker compose up --build
```

API: `http://localhost:8080/api`  
Swagger: `http://localhost:8080/docs`

## Local Verification

From the monorepo root:

```bash
backend/scripts/verify.sh
```

## Notes

- Public API paths remain under `/api`.
- Error responses remain `{ "error": "...", "message": "..." }`.
- ML-specific reusable code now lives in `ml`, while backend keeps database and HTTP orchestration.
