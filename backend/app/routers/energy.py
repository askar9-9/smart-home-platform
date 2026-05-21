from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.routers.deps import CurrentUser, Db
from app.services.energy import (
    energy_consumption as build_energy_consumption,
    energy_devices as build_energy_devices,
    energy_forecast as build_energy_forecast,
    energy_summary,
)

router = APIRouter()


@router.get("/energy/summary")
async def get_energy_summary(_: CurrentUser, db: Db, period: str = "day") -> dict[str, Any]:
    return await energy_summary(db, period)


@router.get("/energy/consumption")
async def energy_consumption(_: CurrentUser, db: Db, period: str = "day", granularity: str = "hour") -> dict[str, Any]:
    return await build_energy_consumption(db, period, granularity)


@router.get("/energy/devices")
async def energy_devices(_: CurrentUser, db: Db, period: str = "day") -> list[dict[str, Any]]:
    return await build_energy_devices(db, period)


@router.get("/energy/forecast")
async def energy_forecast(_: CurrentUser, db: Db) -> dict[str, Any]:
    return await build_energy_forecast(db)
