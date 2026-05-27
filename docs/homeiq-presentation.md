# homeIQ Presentation Readiness

## Demo Flow

1. Start the stack with `docker compose up --build`.
2. Open `http://localhost:3000` and sign in with `testadmin / testpass123`.
3. Show the dashboard: system status, device counts, realtime connection, recent events, energy summary.
4. Open Integrations, create or use an MQTT integration, then add a custom MQTT device with the constructor.
5. Publish a test state to the configured `state_topic`; verify the entity state, event log, and dashboard update.
6. Trigger a light or switch action from the UI; verify command publishing through the configured `command_topic`.
7. Open Energy and ML Anomalies to show consumption, forecast, and trained-model anomaly detection.

## Architecture Talking Points

- Backend is a FastAPI service with PostgreSQL persistence, JWT auth, SSE event streaming, automations, MQTT orchestration, energy workflows, and ML-backed anomaly detection.
- Frontend is a React/Vite/TypeScript SPA with typed API access, protected routes, realtime cache invalidation, operational status, and MQTT onboarding.
- ML remains isolated in the reusable `ml` package; backend calls it only through `backend/app/services/ml.py`.
- MQTT devices can now be onboarded without code changes by entering custom topics and entity metadata in the UI.

## Production Readiness Checklist

- Auth: JWT-protected API except health and login.
- API contract: stable `/api` base path and consistent `{ "error": "...", "message": "..." }` errors.
- Runtime: Docker Compose stack includes PostgreSQL, Mosquitto, backend, and frontend.
- Observability: dashboard exposes API, database, MQTT, seed, simulation, and migration status.
- Data model: devices, entities, states, events, automations, energy readings, integrations.
- Realtime: SSE stream keeps frontend views fresh after state changes and automation runs.
- MQTT: reconnect loop, static wildcard subscriptions, dynamic exact-topic subscriptions from DB, command publishing.
- ML: model artifact loading, feature extraction, IsolationForest scoring, severity/reason mapping.
- Verification: backend integration tests, frontend unit tests, TypeScript build, optional full-stack smoke.

## MQTT Constructor Contract

Use `POST /api/integrations/{integration_id}/mqtt/devices` for custom MQTT onboarding.

Required:

- MQTT integration id.
- Device `name`, `type`, and at least one entity.
- Entity `entity_id`, `domain`, `name`, and `state_topic`.
- `command_topic` for controllable `light`, `switch`, and `climate` entities.

Rejected:

- Non-MQTT integration.
- Duplicate entity ids.
- MQTT wildcard characters `+` and `#` in configured exact topics.
- Empty entity list.

Result:

- Creates a `Device`.
- Creates linked `Entity` rows with MQTT topics stored in `attributes`.
- Creates initial `EntityState` history rows.
- Refreshes MQTT subscriptions when the MQTT client is connected.

## Acceptance Smoke

```bash
docker compose up --build
```

```bash
curl http://localhost:8080/api/health
```

```bash
mosquitto_pub -h localhost -p 1883 \
  -t home/custom/presentation_lamp/state \
  -m on
```

Expected result: homeIQ shows the MQTT device as `on`, writes an event, and keeps the dashboard in sync.
