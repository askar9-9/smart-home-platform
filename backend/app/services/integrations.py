from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, Entity, EntityState, Integration, utcnow


DISCOVERY_CATALOG: dict[str, list[dict[str, Any]]] = {
    "demo": [
        {
            "discovered_id": "demo.porch_light",
            "name": "Porch Light",
            "type": "light",
            "manufacturer": "Demo",
            "model": "DL-100",
            "entities": [
                {
                    "entity_id": "light.porch_light",
                    "domain": "light",
                    "name": "Porch Light",
                    "state": "off",
                    "attributes": {"brightness": 0},
                }
            ],
        },
        {
            "discovered_id": "demo.garage_outlet",
            "name": "Garage Outlet",
            "type": "switch",
            "manufacturer": "Demo",
            "model": "DS-10",
            "entities": [
                {
                    "entity_id": "switch.garage_outlet",
                    "domain": "switch",
                    "name": "Garage Outlet",
                    "state": "off",
                    "attributes": {},
                }
            ],
        },
        {
            "discovered_id": "demo.office_climate",
            "name": "Office Climate",
            "type": "climate",
            "manufacturer": "Demo",
            "model": "DC-22",
            "entities": [
                {
                    "entity_id": "climate.office",
                    "domain": "climate",
                    "name": "Office Climate",
                    "state": "off",
                    "attributes": {"current_temperature": 22, "target_temperature": 22, "hvac_mode": "off"},
                    "device_class": "temperature",
                }
            ],
        },
        {
            "discovered_id": "demo.balcony_sensor",
            "name": "Balcony Sensor",
            "type": "sensor",
            "manufacturer": "Demo",
            "model": "DT-2",
            "entities": [
                {
                    "entity_id": "sensor.balcony_temperature",
                    "domain": "sensor",
                    "name": "Balcony Temperature",
                    "state": "21.5",
                    "attributes": {"friendly_name": "Balcony Temperature"},
                    "unit_of_measurement": "°C",
                    "device_class": "temperature",
                },
                {
                    "entity_id": "sensor.balcony_humidity",
                    "domain": "sensor",
                    "name": "Balcony Humidity",
                    "state": "41",
                    "attributes": {},
                    "unit_of_measurement": "%",
                    "device_class": "humidity",
                },
            ],
        },
        {
            "discovered_id": "demo.solar_meter",
            "name": "Solar Meter",
            "type": "energy_meter",
            "manufacturer": "Demo",
            "model": "DE-3",
            "entities": [
                {
                    "entity_id": "sensor.solar_meter_power",
                    "domain": "sensor",
                    "name": "Solar Meter Power",
                    "state": "0",
                    "attributes": {"energy_meter": True},
                    "unit_of_measurement": "W",
                    "device_class": "power",
                },
                {
                    "entity_id": "sensor.solar_meter_total",
                    "domain": "sensor",
                    "name": "Solar Meter Total",
                    "state": "0",
                    "attributes": {"state_class": "total_increasing"},
                    "unit_of_measurement": "kWh",
                    "device_class": "energy",
                },
            ],
        },
    ],
    "mqtt": [
        {
            "discovered_id": "mqtt.living_room_strip",
            "name": "MQTT Living Room Strip",
            "type": "light",
            "manufacturer": "MQTT",
            "model": "RGB-Strip",
            "entities": [
                {
                    "entity_id": "light.mqtt_living_room_strip",
                    "domain": "light",
                    "name": "MQTT Living Room Strip",
                    "state": "off",
                    "attributes": {
                        "brightness": 0,
                        "state_topic": "home/living_room/strip/state",
                        "command_topic": "home/living_room/strip/set",
                        "brightness_state_topic": "home/living_room/strip/brightness/state",
                        "brightness_command_topic": "home/living_room/strip/brightness/set",
                    },
                }
            ],
        },
        {
            "discovered_id": "mqtt.garage_relay",
            "name": "MQTT Garage Relay",
            "type": "switch",
            "manufacturer": "MQTT",
            "model": "Relay-1",
            "entities": [
                {
                    "entity_id": "switch.mqtt_garage_relay",
                    "domain": "switch",
                    "name": "MQTT Garage Relay",
                    "state": "off",
                    "attributes": {
                        "state_topic": "home/garage/relay/state",
                        "command_topic": "home/garage/relay/set",
                    },
                }
            ],
        },
        {
            "discovered_id": "mqtt.office_sensor",
            "name": "MQTT Office Sensor",
            "type": "sensor",
            "manufacturer": "MQTT",
            "model": "TH-1",
            "entities": [
                {
                    "entity_id": "sensor.mqtt_office_temperature",
                    "domain": "sensor",
                    "name": "MQTT Office Temperature",
                    "state": "22.4",
                    "attributes": {
                        "state_topic": "home/office/sensor/temperature",
                    },
                    "unit_of_measurement": "°C",
                    "device_class": "temperature",
                },
                {
                    "entity_id": "sensor.mqtt_office_humidity",
                    "domain": "sensor",
                    "name": "MQTT Office Humidity",
                    "state": "43",
                    "attributes": {
                        "state_topic": "home/office/sensor/humidity",
                    },
                    "unit_of_measurement": "%",
                    "device_class": "humidity",
                },
            ],
        },
    ],
}


def supported_integration_domain(domain: str) -> bool:
    return domain in DISCOVERY_CATALOG


async def get_integration_or_404(db: AsyncSession, integration_id: uuid.UUID) -> Integration:
    integration = await db.get(Integration, integration_id)
    if integration is None:
        raise HTTPException(404, "Integration not found")
    return integration


async def discovery_preview(db: AsyncSession, integration: Integration) -> list[dict[str, Any]]:
    if not supported_integration_domain(integration.domain):
        raise HTTPException(400, "Unsupported integration domain")
    entity_ids = [entity["entity_id"] for item in DISCOVERY_CATALOG[integration.domain] for entity in item["entities"]]
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
        for item in DISCOVERY_CATALOG[integration.domain]
    ]


async def import_discovered_devices(db: AsyncSession, integration: Integration, discovered_ids: list[str] | None = None) -> dict[str, Any]:
    if not supported_integration_domain(integration.domain):
        raise HTTPException(400, "Unsupported integration domain")
    catalog = {item["discovered_id"]: item for item in DISCOVERY_CATALOG[integration.domain]}
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
