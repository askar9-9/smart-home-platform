from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Area, Automation, Device, EnergyReading, Entity, EntityState, Event, Home, Integration, User
from app.services.energy_ingest import seed_demo_energy_history


EXPECTED_SEED_COUNTS = {
    "users": 1,
    "homes": 1,
    "integrations": 1,
    "areas": 4,
    "devices": 8,
    "entities": 10,
    "automations": 2,
    "entity_states": 10,
    "energy_readings": 336,
    "events": 0,
}


async def seed_counts(db: AsyncSession) -> dict[str, int]:
    models = {
        "users": User,
        "homes": Home,
        "integrations": Integration,
        "areas": Area,
        "devices": Device,
        "entities": Entity,
        "automations": Automation,
        "entity_states": EntityState,
        "energy_readings": EnergyReading,
        "events": Event,
    }
    counts: dict[str, int] = {}
    for name, model in models.items():
        counts[name] = (await db.execute(select(func.count()).select_from(model))).scalar_one()
    return counts


async def ensure_demo_energy_history(db: AsyncSession) -> int:
    rows = (
        await db.execute(
            select(Entity).where(Entity.entity_id.in_(["sensor.main_energy_power", "sensor.main_energy_total"]))
        )
    ).scalars().all()
    by_entity_id = {row.entity_id: row for row in rows}
    power_entity = by_entity_id.get("sensor.main_energy_power")
    total_entity = by_entity_id.get("sensor.main_energy_total")
    if power_entity is None or total_entity is None:
        return 0
    return await seed_demo_energy_history(db, power_entity, total_entity)


async def seed_database(db: AsyncSession) -> None:
    existing = (await db.execute(select(User).where(User.username == "testadmin"))).scalar_one_or_none()
    if existing is not None:
        await ensure_demo_energy_history(db)
        await db.commit()
        return

    now = datetime.now(UTC)
    user = User(name="Test Admin", username="testadmin", password_hash=hash_password("testpass123"), is_admin=True)
    home = Home(
        name="homeIQ Demo Home",
        latitude=43.238949,
        longitude=76.889709,
        elevation=700,
        time_zone="Asia/Almaty",
        currency="KZT",
        unit_system={"temperature": "C", "length": "metric"},
    )
    db.add_all([user, home])
    await db.flush()

    integration = Integration(
        home_id=home.id,
        name="Live MQTT Broker",
        domain="mqtt",
        config_json={"broker": "mosquitto", "purpose": "live-demo"},
    )
    db.add(integration)
    await db.flush()

    areas = {
        "living": Area(home_id=home.id, name="Гостиная", icon="mdi:sofa"),
        "kitchen": Area(home_id=home.id, name="Кухня", icon="mdi:stove"),
        "bedroom": Area(home_id=home.id, name="Спальня", icon="mdi:bed"),
        "hallway": Area(home_id=home.id, name="Коридор", icon="mdi:door"),
    }
    db.add_all(areas.values())
    await db.flush()

    device_specs = [
        ("Hallway Light", "light", "hallway", "MQTT", "Dimmer-1"),
        ("Kitchen Outlet", "switch", "kitchen", "MQTT", "Relay-1"),
        ("Bedroom Climate", "climate", "bedroom", "MQTT", "Climate-1"),
        ("Living Room Sensor", "sensor", "living", "MQTT", "TH-1"),
        ("Kitchen Sensor", "sensor", "kitchen", "MQTT", "TH-2"),
        ("Hallway Motion", "sensor", "hallway", "MQTT", "Motion-1"),
        ("Hallway Lux", "sensor", "hallway", "MQTT", "Lux-1"),
        ("Main Energy Meter", "energy_meter", "hallway", "MQTT", "Power-1"),
    ]
    devices: list[Device] = []
    for name, type_, area_key, manufacturer, model in device_specs:
        device = Device(
            home_id=home.id,
            area_id=areas[area_key].id,
            integration_id=integration.id,
            name=name,
            type=type_,
            manufacturer=manufacturer,
            model=model,
            status="online",
        )
        db.add(device)
        devices.append(device)
    await db.flush()

    entities: list[Entity] = []

    def add_entity(
        device: Device,
        entity_id: str,
        domain: str,
        name: str,
        state: str,
        attrs: dict[str, Any] | None = None,
        unit: str | None = None,
        device_class: str | None = None,
    ) -> Entity:
        entity = Entity(
            entity_id=entity_id,
            device_id=device.id,
            area_id=device.area_id,
            domain=domain,
            platform="mqtt",
            name=name,
            original_name=name,
            state=state,
            attributes_json=attrs or {},
            unit_of_measurement=unit,
            device_class=device_class,
        )
        db.add(entity)
        entities.append(entity)
        return entity

    add_entity(
        devices[0],
        "light.hallway",
        "light",
        "Hallway Light",
        "off",
        {
            "brightness": 0,
            "state_topic": "home/hallway/light/state",
            "command_topic": "home/hallway/light/set",
            "brightness_state_topic": "home/hallway/light/brightness/state",
            "brightness_command_topic": "home/hallway/light/brightness/set",
        },
    )
    add_entity(
        devices[1],
        "switch.kitchen_outlet",
        "switch",
        "Kitchen Outlet",
        "off",
        {"state_topic": "home/kitchen/outlet/state", "command_topic": "home/kitchen/outlet/set"},
    )
    add_entity(
        devices[2],
        "climate.bedroom",
        "climate",
        "Bedroom Climate",
        "off",
        {
            "current_temperature": 21,
            "target_temperature": 22,
            "hvac_mode": "off",
            "state_topic": "home/bedroom/climate/state",
            "command_topic": "home/bedroom/climate/set",
        },
        None,
        "temperature",
    )
    add_entity(
        devices[3],
        "sensor.living_room_temperature",
        "sensor",
        "Living Room Temperature",
        "22.5",
        {"state_topic": "home/living_room/sensor/temperature/state"},
        "°C",
        "temperature",
    )
    add_entity(
        devices[4],
        "sensor.kitchen_temperature",
        "sensor",
        "Kitchen Temperature",
        "23.1",
        {"state_topic": "home/kitchen/sensor/temperature/state"},
        "°C",
        "temperature",
    )
    add_entity(
        devices[4],
        "sensor.kitchen_humidity",
        "sensor",
        "Kitchen Humidity",
        "45",
        {"state_topic": "home/kitchen/sensor/humidity/state"},
        "%",
        "humidity",
    )
    add_entity(
        devices[5],
        "binary_sensor.hallway_motion",
        "binary_sensor",
        "Hallway Motion",
        "off",
        {"device_class": "motion", "state_topic": "home/hallway/motion/state"},
        None,
        "motion",
    )
    add_entity(
        devices[6],
        "sensor.hallway_lux",
        "sensor",
        "Hallway Lux",
        "15",
        {"state_topic": "home/hallway/lux/state"},
        "lx",
        "illuminance",
    )
    add_entity(
        devices[7],
        "sensor.main_energy_power",
        "sensor",
        "Main Energy Power",
        "0",
        {"energy_meter": True, "state_topic": "home/hallway/meter/power/state"},
        "W",
        "power",
    )
    add_entity(
        devices[7],
        "sensor.main_energy_total",
        "sensor",
        "Main Energy Total",
        "0",
        {"state_class": "total_increasing", "state_topic": "home/hallway/meter/total/state"},
        "kWh",
        "energy",
    )
    await db.flush()

    await ensure_demo_energy_history(db)

    areas["living"].temperature_entity_id = "sensor.living_room_temperature"
    areas["kitchen"].temperature_entity_id = "sensor.kitchen_temperature"
    areas["kitchen"].humidity_entity_id = "sensor.kitchen_humidity"

    automations = [
        Automation(
            home_id=home.id,
            name="Свет в коридоре при движении",
            description="Включает коридорный свет при движении и низкой освещенности",
            trigger_json={"type": "state_changed", "entity_id": "binary_sensor.hallway_motion", "to": "on"},
            condition_json={"entity_id": "sensor.hallway_lux", "operator": "lt", "value": 30},
            action_json={"domain": "light", "action": "turn_on", "target": {"entity_id": "light.hallway"}, "data": {"brightness": 80}},
        ),
        Automation(
            home_id=home.id,
            name="Предупреждение высокого потребления",
            description="Отключает розетку при перегрузке по счетчику энергии",
            trigger_json={"type": "state_changed", "entity_id": "sensor.main_energy_power"},
            condition_json={"entity_id": "sensor.main_energy_power", "operator": "gt", "value": 1400},
            action_json={"domain": "switch", "action": "turn_off", "target": {"entity_id": "switch.kitchen_outlet"}},
        ),
    ]
    db.add_all(automations)

    for entity in entities:
        db.add(EntityState(entity_id=entity.entity_id, state=entity.state, attributes_json=entity.attributes_json, last_changed=now, last_updated=now))

    await db.commit()
