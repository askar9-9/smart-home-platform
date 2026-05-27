from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models import Device
from app.core.dependencies import CurrentUser, Db
from app.schemas import DeviceCreate, DeviceUpdate
from app.serializers import device_out
from app.services.common import delete_by_id, get_default_home
from app.services.devices import create_default_entity_for_device

router = APIRouter()


@router.get("/devices")
async def list_devices(
    _: CurrentUser,
    db: Db,
    area_id: uuid.UUID | None = None,
    type: str | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    stmt = select(Device).options(selectinload(Device.area), selectinload(Device.entities)).order_by(Device.created_at)
    count_stmt = select(func.count(Device.id))
    if area_id:
        stmt = stmt.where(Device.area_id == area_id)
        count_stmt = count_stmt.where(Device.area_id == area_id)
    if type:
        stmt = stmt.where(Device.type == type)
        count_stmt = count_stmt.where(Device.type == type)
    if status:
        stmt = stmt.where(Device.status == status)
        count_stmt = count_stmt.where(Device.status == status)
    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return {"total": total, "limit": limit, "offset": offset, "devices": [device_out(device) for device in rows]}


@router.post("/devices", status_code=201)
async def create_device(payload: DeviceCreate, _: CurrentUser, db: Db) -> dict[str, Any]:
    if payload.type not in {"light", "switch", "sensor", "climate", "energy_meter"}:
        raise HTTPException(400, "Unsupported device type")
    home = await get_default_home(db)
    device = Device(home_id=home.id, **payload.model_dump())
    db.add(device)
    await db.flush()
    await create_default_entity_for_device(db, device)
    await db.commit()
    result = await db.execute(select(Device).options(selectinload(Device.area), selectinload(Device.entities)).where(Device.id == device.id))
    return device_out(result.scalar_one(), detailed=True)


@router.get("/devices/{device_id}")
async def get_device(device_id: uuid.UUID, _: CurrentUser, db: Db) -> dict[str, Any]:
    device = (await db.execute(select(Device).options(selectinload(Device.area), selectinload(Device.entities)).where(Device.id == device_id))).scalar_one_or_none()
    if device is None:
        raise HTTPException(404, "Device not found")
    return device_out(device, detailed=True)


@router.patch("/devices/{device_id}")
async def update_device(device_id: uuid.UUID, payload: DeviceUpdate, _: CurrentUser, db: Db) -> dict[str, Any]:
    device = (
        await db.execute(select(Device).options(selectinload(Device.area), selectinload(Device.entities)).where(Device.id == device_id))
    ).scalar_one_or_none()
    if device is None:
        raise HTTPException(404, "Device not found")
    updates = payload.model_dump(exclude_unset=True)
    area_changed = "area_id" in updates and updates["area_id"] != device.area_id
    for key, value in updates.items():
        setattr(device, key, value)
    if area_changed:
        for entity in device.entities:
            entity.area_id = device.area_id
    await db.commit()
    result = await db.execute(select(Device).options(selectinload(Device.area), selectinload(Device.entities)).where(Device.id == device.id))
    return device_out(result.scalar_one(), detailed=True)


@router.delete("/devices/{device_id}", status_code=204)
async def delete_device(device_id: uuid.UUID, _: CurrentUser, db: Db) -> Response:
    await delete_by_id(db, Device, device_id)
    return Response(status_code=204)
