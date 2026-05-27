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
- `app/services/mqtt_client.py`: async MQTT client (connects to Mosquitto, subscribes to device state topics, publishes commands)
- `app/services/mqtt_handler.py`: routes incoming MQTT messages to entity state updates
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

## MQTT Integration

The backend can connect to a Mosquitto broker and exchange messages with MQTT devices.

- `MQTT_ENABLED` env var controls whether the client connects (default `false`).
- In Docker Compose, Mosquitto runs on `mosquitto:1883` and `MQTT_ENABLED=true`.
- Subscribed topics: `home/+/+/state`, `home/+/+/brightness/state`, `home/+/+/temperature/state`, `home/+/+/humidity/state`, `home/+/+/availability`.
- When a message arrives, `mqtt_handler.py` matches it to an entity by `state_topic` in `attributes_json`, then calls `set_entity_state()`.
- When an action (turn_on/turn_off/etc.) is called on an MQTT-platform entity, `actions.py` publishes to the entity's `command_topic`.
- This means MQTT device state changes go through the same event bus and automation pipeline as REST API changes.
