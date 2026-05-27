from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, Entity, EntityState, Integration, utcnow
from app.schemas import MqttDeviceCreate, MqttEntitySpec
from app.services.integration_catalog import get_catalog, supported_integration_domain

_CONTROLLABLE_DOMAINS = {"light", "switch", "climate"}
_SUPPORTED_DEVICE_TYPES = {"light", "switch", "sensor", "climate", "energy_meter"}


async def get_integration_or_404(db: AsyncSession, integration_id: uuid.UUID) -> Integration:
    integration = await db.get(Integration, integration_id)
    if integration is None:
        raise HTTPException(404, "Integration not found")
    return integration


async def discovery_preview(db: AsyncSession, integration: Integration) -> list[dict[str, Any]]:
    if not supported_integration_domain(integration.domain):
        raise HTTPException(400, "Unsupported integration domain")
    catalog = get_catalog(integration.domain)
    entity_ids = [entity["entity_id"] for item in catalog for entity in item["entities"]]
    existing = set((await db.execute(select(Entity.entity_id).where(Entity.entity_id.in_(entity_ids)))).scalars().all())
    return [
        {
            "discovered_id": item["discovered_id"],
            "name": item["name"],
            "type": item["type"],
            "manufacturer": item.get("manufacturer"),
            "model": item.get("model"),
            "suggested_entity_id": item["entities"][0]["entity_id"],
            "entities": [
                {
                    "entity_id": entity["entity_id"],
                    "domain": entity["domain"],
                    "platform": integration.domain,
                    "name": entity["name"],
                    "attributes": entity.get("attributes") or {},
                    "unit_of_measurement": entity.get("unit_of_measurement"),
                    "device_class": entity.get("device_class"),
                }
                for entity in item["entities"]
            ],
            "already_imported": any(entity["entity_id"] in existing for entity in item["entities"]),
        }
        for item in catalog
    ]


async def import_discovered_devices(db: AsyncSession, integration: Integration, discovered_ids: list[str] | None = None) -> dict[str, Any]:
    if not supported_integration_domain(integration.domain):
        raise HTTPException(400, "Unsupported integration domain")
    catalog = {item["discovered_id"]: item for item in get_catalog(integration.domain)}
    selected_ids = discovered_ids or list(catalog)
    unknown = [item_id for item_id in selected_ids if item_id not in catalog]
    if unknown:
        raise HTTPException(400, f"Unknown discovered_id: {unknown[0]}")

    imported: list[Device] = []
    skipped: list[dict[str, Any]] = []
    for item_id in selected_ids:
        item = catalog[item_id]
        entity_ids = [entity["entity_id"] for entity in item["entities"]]
        existing = (await db.execute(select(Entity.entity_id).where(Entity.entity_id.in_(entity_ids)).limit(1))).scalar_one_or_none()
        if existing is not None:
            skipped.append({"discovered_id": item_id, "reason": "already_imported", "entity_id": existing})
            continue

        device = Device(
            home_id=integration.home_id,
            integration_id=integration.id,
            name=item["name"],
            type=item["type"],
            manufacturer=item.get("manufacturer"),
            model=item.get("model"),
            status="online",
        )
        db.add(device)
        await db.flush()
        now = utcnow()
        for entity_spec in item["entities"]:
            entity = Entity(
                entity_id=entity_spec["entity_id"],
                device_id=device.id,
                area_id=device.area_id,
                domain=entity_spec["domain"],
                platform=integration.domain,
                name=entity_spec["name"],
                original_name=entity_spec["name"],
                state=str(entity_spec["state"]),
                attributes_json=entity_spec.get("attributes") or {},
                unit_of_measurement=entity_spec.get("unit_of_measurement"),
                device_class=entity_spec.get("device_class"),
                created_at=now,
                updated_at=now,
            )
            db.add(entity)
            db.add(
                EntityState(
                    entity_id=entity.entity_id,
                    state=entity.state,
                    attributes_json=entity.attributes_json,
                    last_changed=now,
                    last_updated=now,
                    created_at=now,
                )
            )
        imported.append(device)
    await db.commit()
    return {"imported": imported, "skipped": skipped}


def _validate_mqtt_topic(topic: str | None, *, field_name: str) -> str | None:
    if topic is None:
        return None
    value = topic.strip()
    if not value:
        raise HTTPException(400, f"{field_name} is required")
    if "+" in value or "#" in value:
        raise HTTPException(400, f"{field_name} must not contain MQTT wildcards")
    return value


def _entity_attrs(spec: MqttEntitySpec) -> dict[str, Any]:
    attrs = dict(spec.attributes or {})
    for key in (
        "state_topic",
        "command_topic",
        "availability_topic",
        "brightness_state_topic",
        "brightness_command_topic",
    ):
        value = getattr(spec, key)
        if value is not None:
            attrs[key] = value.strip()
    return attrs


async def create_mqtt_device(db: AsyncSession, integration: Integration, payload: MqttDeviceCreate) -> Device:
    if integration.domain != "mqtt":
        raise HTTPException(400, "MQTT device constructor requires an mqtt integration")
    if payload.type not in _SUPPORTED_DEVICE_TYPES:
        raise HTTPException(400, "Unsupported device type")

    seen: set[str] = set()
    for spec in payload.entities:
        entity_id = spec.entity_id.strip()
        if not entity_id:
            raise HTTPException(400, "entity_id is required")
        if entity_id in seen:
            raise HTTPException(400, f"Duplicate entity_id: {entity_id}")
        seen.add(entity_id)

        spec.state_topic = _validate_mqtt_topic(spec.state_topic, field_name=f"{entity_id}.state_topic") or ""
        spec.command_topic = _validate_mqtt_topic(spec.command_topic, field_name=f"{entity_id}.command_topic")
        spec.availability_topic = _validate_mqtt_topic(spec.availability_topic, field_name=f"{entity_id}.availability_topic")
        spec.brightness_state_topic = _validate_mqtt_topic(spec.brightness_state_topic, field_name=f"{entity_id}.brightness_state_topic")
        spec.brightness_command_topic = _validate_mqtt_topic(spec.brightness_command_topic, field_name=f"{entity_id}.brightness_command_topic")

        if spec.domain in _CONTROLLABLE_DOMAINS and not spec.command_topic:
            raise HTTPException(400, f"{entity_id}.command_topic is required for {spec.domain}")

    existing = (await db.execute(select(Entity.entity_id).where(Entity.entity_id.in_(seen)))).scalars().first()
    if existing is not None:
        raise HTTPException(400, f"Entity already exists: {existing}")

    device = Device(
        home_id=integration.home_id,
        integration_id=integration.id,
        area_id=payload.area_id,
        name=payload.name,
        type=payload.type,
        manufacturer=payload.manufacturer,
        model=payload.model,
        status=payload.status,
    )
    db.add(device)
    await db.flush()

    now = utcnow()
    for spec in payload.entities:
        entity = Entity(
            entity_id=spec.entity_id.strip(),
            device_id=device.id,
            area_id=device.area_id,
            domain=spec.domain.strip(),
            platform="mqtt",
            name=spec.name,
            original_name=spec.name,
            state=spec.state,
            attributes_json=_entity_attrs(spec),
            unit_of_measurement=spec.unit_of_measurement,
            device_class=spec.device_class,
            created_at=now,
            updated_at=now,
        )
        db.add(entity)
        db.add(
            EntityState(
                entity_id=entity.entity_id,
                state=entity.state,
                attributes_json=entity.attributes_json,
                last_changed=now,
                last_updated=now,
                created_at=now,
            )
        )

    await db.commit()
    return device
