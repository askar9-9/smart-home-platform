# Architecture

## Overview

The monorepo is split into three concerns:

- `backend`: HTTP API, persistence, seeding, automation execution, event streaming, and energy workflows.
- `frontend`: authenticated SPA that consumes the backend contract and renders the Smart Home flows.
- `ml`: reusable ML primitives for energy anomaly feature extraction and model artifact loading.

## Backend Shape

Request flow:

```text
FastAPI routers -> services -> SQLAlchemy models -> PostgreSQL -> SSE / domain events
```

Responsibilities:

- `app/routers`: thin HTTP layer, request parsing, auth dependencies, response shaping.
- `app/services`: domain workflows and orchestration such as state transitions, automations, integrations, energy, and ML-backed anomaly detection.
- `app/models`: ORM schema and relationships.
- `app/core`: auth, dependency wiring, errors, event bus.

## Frontend Shape

Frontend is a React + Vite SPA with:

- `src/api`: transport client and DTO typing
- `src/auth`: JWT handling and route protection
- `src/components`: reusable UI building blocks
- `src/pages`: route-level screens
- `tests/unit` and `tests/e2e`: verification coverage

## ML Boundary

The ML package is intentionally narrow:

- feature extraction
- model artifact loading
- anomaly score helper logic

Backend-specific concerns remain in `backend/app/services/ml.py`:

- querying energy readings from PostgreSQL
- mapping runtime failures to HTTP errors
- preserving the `/api/ml/anomalies` response contract
