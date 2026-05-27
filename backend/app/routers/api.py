from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.config import settings
from app.core.dependencies import CurrentUser
from app.routers import actions, areas, auth, automations, dashboard, devices, energy, entities, events, homes, integrations, ml
from app.services.mqtt_client import mqtt_client

api = APIRouter(prefix="/api")


@api.get("/health", include_in_schema=False)
async def health() -> dict[str, Any]:
    return {"ok": True, "service": "homeiq-backend"}


@api.get("/system/status")
async def system_status(_: CurrentUser) -> dict[str, Any]:
    return {
        "service": "homeiq-backend",
        "api": "ready",
        "database": "ready",
        "mqtt": {
            "enabled": settings.mqtt_enabled,
            "connected": mqtt_client.connected,
            "host": settings.mqtt_host if settings.mqtt_enabled else None,
            "port": settings.mqtt_port if settings.mqtt_enabled else None,
        },
        "runtime": {
            "seed_enabled": settings.seed_enabled,
            "sim_enabled": settings.sim_enabled,
            "run_migrations_on_start": settings.run_migrations_on_start,
        },
    }


api.include_router(auth.router)
api.include_router(homes.router)
api.include_router(integrations.router)
api.include_router(areas.router)
api.include_router(devices.router)
api.include_router(entities.router)
api.include_router(actions.router)
api.include_router(events.router)
api.include_router(automations.router)
api.include_router(energy.router)
api.include_router(ml.router)
api.include_router(dashboard.router)
