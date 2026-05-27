from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, Entity


def slugify(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "_" for ch in value).strip("_")
    return "_".join(part for part in cleaned.split("_") if part) or "device"


async def create_default_entity_for_device(db: AsyncSession, device: Device) -> Entity:
    object_id = slugify(device.name_by_user or device.name)
    base = {
        "device_id": device.id,
        "area_id": device.area_id,
        "platform": "manual",
        "name": device.name_by_user or device.name,
        "original_name": device.name,
    }
    if device.type == "light":
        entity = Entity(entity_id=f"light.{object_id}", domain="light", state="off", attributes_json={"brightness": 0}, **base)
    elif device.type == "switch":
        entity = Entity(entity_id=f"switch.{object_id}", domain="switch", state="off", attributes_json={}, **base)
    elif device.type == "climate":
        entity = Entity(
            entity_id=f"climate.{object_id}",
            domain="climate",
            state="off",
            attributes_json={"current_temperature": 22, "target_temperature": 22, "hvac_mode": "off"},
            device_class="temperature",
            **base,
        )
    elif device.type == "energy_meter":
        entity = Entity(
            entity_id=f"sensor.{object_id}_power",
            domain="sensor",
            state="0",
            attributes_json={"friendly_name": device.name, "energy_meter": True},
            unit_of_measurement="W",
            device_class="power",
            **base,
        )
    else:
        entity = Entity(
            entity_id=f"sensor.{object_id}",
            domain="sensor",
            state="0",
            attributes_json={"friendly_name": device.name},
            unit_of_measurement="",
            **base,
        )
    db.add(entity)
    await db.flush()
    return entity
