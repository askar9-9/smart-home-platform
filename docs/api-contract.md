# API Contract

Base URL: `/api`

All endpoints except `GET /health` and `POST /auth/login` require `Authorization: Bearer <jwt>`.

Error responses keep this shape:

```json
{ "error": "not_found", "message": "Resource not found" }
```

## Auth

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Core Resources

- `GET|POST /homes`
- `GET|POST /areas`
- `PATCH|DELETE /areas/{area_id}`
- `GET|POST /devices`
- `GET|PATCH|DELETE /devices/{device_id}`
- `GET /entities`
- `GET /entities/{entity_id}`
- `PATCH /entities/{entity_id}/state`
- `GET /entities/{entity_id}/history`

## Actions, Events, Automations

- `POST /actions/call`
- `GET /events`
- `GET /events/stream`
- `GET|POST /automations`
- `GET|PATCH|DELETE /automations/{automation_id}`
- `POST /automations/{automation_id}/run`

## Integrations

- `GET|POST /integrations`
- `GET|PATCH|DELETE /integrations/{integration_id}`
- `GET /integrations/{integration_id}/discovery`
- `POST /integrations/{integration_id}/import`
- `POST /integrations/{integration_id}/mqtt/devices`

Supported onboarding includes mock/demo discovery plus manual MQTT device construction for custom topics.

`POST /integrations/{integration_id}/mqtt/devices` accepts device metadata and one or more MQTT entity specs:

```json
{
  "name": "Presentation Lamp",
  "type": "light",
  "area_id": null,
  "manufacturer": "homeIQ",
  "model": "MQTT-1",
  "entities": [
    {
      "entity_id": "light.presentation_lamp",
      "domain": "light",
      "name": "Presentation Lamp",
      "state": "off",
      "state_topic": "home/custom/presentation_lamp/state",
      "command_topic": "home/custom/presentation_lamp/set",
      "availability_topic": "home/custom/presentation_lamp/availability",
      "attributes": { "brightness": 0 },
      "brightness_state_topic": "home/custom/presentation_lamp/brightness/state",
      "brightness_command_topic": "home/custom/presentation_lamp/brightness/set"
    }
  ]
}
```

The endpoint returns the created `Device` shape with nested `entities`.

## System

- `GET /system/status`

Returns API, database, MQTT, and runtime flags for presentation and operational checks.

## Energy And ML

- `GET /energy/summary`
- `GET /energy/consumption`
- `GET /energy/devices`
- `GET /energy/forecast`
- `GET /ml/anomalies`

`/ml/anomalies` and energy endpoints keep their existing response contract even though reusable ML code now lives in `ml`.
