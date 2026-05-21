# Frontend Agent Notes

This project is the Smart Home frontend SPA.

## Scope

- Keep the app aligned with the backend `/api` contract.
- Do not silently invent frontend-only data contracts that diverge from backend DTOs.
- Keep auth, query invalidation, and realtime behavior consistent across pages.

## Structure

- `src/api`: transport, env config, API DTO types
- `src/auth`: auth provider and protected routes
- `src/components`: shared UI and controls
- `src/pages`: route-level screens
- `src/shared`: query keys and invalidation helpers
- `tests/unit` and `tests/e2e`: verification layers

## Local Verification

```bash
cd frontend
npm test
npm run build
```

## Safety

- Do not commit `node_modules`, `dist`, coverage, or test-result artifacts.
- Prefer fixing type drift at the source rather than weakening types globally.
- Keep `VITE_API_BASE_URL` configurable and defaulted to `http://localhost:8080/api`.
