from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.eventbus import DomainEvent, event_bus
from app.models import Area, AutomationRun, Device, EnergyReading, Entity, EntityState, Event
from app.seed import EXPECTED_SEED_COUNTS, seed_counts, seed_database
from app.services.mqtt_client import _SUBSCRIPTION_TOPICS, mqtt_subscription_topics
from app.services.mqtt_client import mqtt_client
from app.services.mqtt_handler import handle_mqtt_state_message

pytestmark = pytest.mark.asyncio


async def test_mqtt_subscriptions_cover_nested_state_topics() -> None:
    assert "home/+/+/state" in _SUBSCRIPTION_TOPICS
    assert "home/+/+/+/state" in _SUBSCRIPTION_TOPICS
    assert "home/+/+/availability" in _SUBSCRIPTION_TOPICS


async def test_mqtt_dynamic_subscriptions_include_exact_configured_topics() -> None:
    entity = Entity(
        entity_id="light.dynamic",
        domain="light",
        name="Dynamic",
        state="off",
        attributes_json={
            "state_topic": "custom/light/state",
            "availability_topic": "custom/light/availability",
            "brightness_state_topic": "custom/light/brightness/state",
            "command_topic": "custom/light/set",
        },
    )

    assert mqtt_subscription_topics([entity]) == {
        "custom/light/state",
        "custom/light/availability",
        "custom/light/brightness/state",
    }


async def test_seed_counts_and_idempotency(db_session: AsyncSession) -> None:
    assert await seed_counts(db_session) == EXPECTED_SEED_COUNTS

    await seed_database(db_session)

    assert await seed_counts(db_session) == EXPECTED_SEED_COUNTS


async def test_auth_required(client: AsyncClient) -> None:
    response = await client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json() == {"error": "unauthorized", "message": "Not authenticated"}


async def test_login_success_and_failure(client: AsyncClient) -> None:
    success = await client.post("/api/auth/login", json={"username": "testadmin", "password": "testpass123"})
    failure = await client.post("/api/auth/login", json={"username": "testadmin", "password": "wrong"})

    assert success.status_code == 200
    body = success.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0
    assert body["user"]["username"] == "testadmin"
    assert failure.status_code == 401


async def test_events_stream_accepts_query_token(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    login = await client.post("/api/auth/login", json={"username": "testadmin", "password": "testpass123"})
    token = login.json()["access_token"]

    missing = await client.get("/api/events/stream")
    invalid = await client.get("/api/events/stream", params={"token": "not-a-token"})

    async def one_event():
        yield DomainEvent(type="state_changed", entity_id="light.hallway", new_state="on")

    monkeypatch.setattr(event_bus, "stream", one_event)
    valid = await client.get("/api/events/stream", params={"token": token})

    assert missing.status_code == 401
    assert invalid.status_code == 401
    assert valid.status_code == 200
    assert "light.hallway" in valid.text


async def test_dashboard_shape(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/api/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["home"]["name"]
    assert len(body["areas"]) >= 1
    assert body["summary"]["devices_total"] >= 0
    assert body["summary"]["devices_online"] >= 0
    assert body["summary"]["automations_active"] >= 0
    assert body["summary"]["energy_today_kwh"] > 0
    assert body["summary"]["current_power_w"] > 0
    assert {"devices_total", "devices_online", "automations_active", "energy_today_kwh", "current_power_w"} == set(body["summary"])
    assert isinstance(body["recent_events"], list)


async def test_areas_crud(auth_client: AsyncClient) -> None:
    created = await auth_client.post("/api/areas", json={"name": "Office", "icon": "mdi:desk"})
    assert created.status_code == 201
    area = created.json()
    assert area["name"] == "Office"
    assert area["device_count"] == 0

    listed = await auth_client.get("/api/areas")
    assert listed.status_code == 200
    assert any(item["id"] == area["id"] for item in listed.json())

    updated = await auth_client.patch(f"/api/areas/{area['id']}", json={"name": "Study"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Study"

    deleted = await auth_client.delete(f"/api/areas/{area['id']}")
    assert deleted.status_code == 204


async def test_devices_crud(auth_client: AsyncClient, db_session: AsyncSession) -> None:
    area = (await db_session.execute(select(Area).where(Area.name == "Коридор"))).scalar_one()
    created = await auth_client.post(
        "/api/devices",
        json={"name": "Desk Lamp", "type": "light", "area_id": str(area.id), "manufacturer": "Demo"},
    )
    assert created.status_code == 201
    device = created.json()
    assert device["name"] == "Desk Lamp"
    assert device["area_id"] == str(area.id)
    assert device["entity_count"] == 1
    assert device["entities"][0]["entity_id"] == "light.desk_lamp"

    listed = await auth_client.get("/api/devices", params={"type": "light", "status": "online"})
    assert listed.status_code == 200
    assert any(item["id"] == device["id"] for item in listed.json()["devices"])

    updated = await auth_client.patch(f"/api/devices/{device['id']}", json={"name_by_user": "Work Lamp"})
    assert updated.status_code == 200
    assert updated.json()["name_by_user"] == "Work Lamp"

    deleted = await auth_client.delete(f"/api/devices/{device['id']}")
    assert deleted.status_code == 204


async def test_device_area_update_syncs_linked_entities(auth_client: AsyncClient, db_session: AsyncSession) -> None:
    areas = (await db_session.execute(select(Area).where(Area.name.in_(["Коридор", "Гостиная"])).order_by(Area.name))).scalars().all()
    hallway = next(area for area in areas if area.name == "Коридор")
    living_room = next(area for area in areas if area.name == "Гостиная")

    created = await auth_client.post(
        "/api/devices",
        json={"name": "Portable Sensor", "type": "sensor", "area_id": str(hallway.id)},
    )
    assert created.status_code == 201
    device = created.json()
    assert device["entities"][0]["area_id"] == str(hallway.id)

    updated = await auth_client.patch(f"/api/devices/{device['id']}", json={"area_id": str(living_room.id)})
    assert updated.status_code == 200
    assert updated.json()["area_id"] == str(living_room.id)
    assert updated.json()["entities"][0]["area_id"] == str(living_room.id)

    entity = (await db_session.execute(select(Entity).where(Entity.device_id == device["id"]))).scalar_one()
    assert str(entity.area_id) == str(living_room.id)


async def test_integrations_auth_required(client: AsyncClient) -> None:
    response = await client.get("/api/integrations")

    assert response.status_code == 401
    assert response.json() == {"error": "unauthorized", "message": "Not authenticated"}


async def test_integrations_crud_contract(auth_client: AsyncClient) -> None:
    created = await auth_client.post("/api/integrations", json={"name": "Pairing Hub", "domain": "mqtt", "config": {"host": "mock-broker"}})

    assert created.status_code == 201
    integration = created.json()
    assert integration["name"] == "Pairing Hub"
    assert integration["domain"] == "mqtt"
    assert integration["config"] == {"host": "mock-broker"}
    assert integration["device_count"] == 0
    assert "T" in integration["created_at"]

    listed = await auth_client.get("/api/integrations")
    assert listed.status_code == 200
    assert any(item["id"] == integration["id"] for item in listed.json())

    fetched = await auth_client.get(f"/api/integrations/{integration['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == integration["id"]

    updated = await auth_client.patch(
        f"/api/integrations/{integration['id']}",
        json={"name": "Updated Hub", "config": {"host": "broker.internal", "port": 1883}},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Hub"
    assert updated.json()["config"] == {"host": "broker.internal", "port": 1883}

    deleted = await auth_client.delete(f"/api/integrations/{integration['id']}")
    assert deleted.status_code == 204


async def test_integration_discovery_and_idempotent_import(auth_client: AsyncClient, db_session: AsyncSession) -> None:
    created = await auth_client.post("/api/integrations", json={"name": "Discovery Hub", "domain": "mqtt", "config": {"host": "mock-broker"}})
    integration = created.json()

    discovery = await auth_client.get(f"/api/integrations/{integration['id']}/discovery")
    assert discovery.status_code == 200
    discovered = discovery.json()
    assert [item["discovered_id"] for item in discovered] == [
        "mqtt.living_room_strip",
        "mqtt.garage_relay",
        "mqtt.office_sensor",
        "mqtt.hallway_motion",
        "mqtt.hallway_lux",
        "mqtt.main_energy_meter",
    ]
    assert discovered[0]["suggested_entity_id"] == "light.mqtt_living_room_strip"
    assert all(item["already_imported"] is False for item in discovered)

    imported = await auth_client.post(f"/api/integrations/{integration['id']}/import", json={})
    assert imported.status_code == 200
    import_body = imported.json()
    assert import_body["integration_id"] == integration["id"]
    assert import_body["imported"] == 6
    assert import_body["skipped"] == []
    assert len(import_body["devices"]) == 6
    assert import_body["devices"][0]["entities"]

    linked_devices = (
        await db_session.execute(select(func.count(Device.id)).where(Device.integration_id == integration["id"]))
    ).scalar_one()
    imported_states = (
        await db_session.execute(
            select(func.count(EntityState.id)).where(
                EntityState.entity_id.in_(
                    [
                        "light.mqtt_living_room_strip",
                        "switch.mqtt_garage_relay",
                        "sensor.mqtt_office_temperature",
                        "sensor.mqtt_office_humidity",
                    ]
                )
            )
        )
    ).scalar_one()
    assert linked_devices == 6
    assert imported_states == 4

    repeated = await auth_client.post(f"/api/integrations/{integration['id']}/import", json={})
    assert repeated.status_code == 200
    repeat_body = repeated.json()
    assert repeat_body["imported"] == 0
    assert len(repeat_body["skipped"]) == 6

    rediscovery = await auth_client.get(f"/api/integrations/{integration['id']}/discovery")
    assert all(item["already_imported"] is True for item in rediscovery.json())


async def test_mqtt_integration_discovery_import_and_actions(auth_client: AsyncClient, db_session: AsyncSession) -> None:
    created = await auth_client.post("/api/integrations", json={"name": "MQTT Broker", "domain": "mqtt", "config": {"host": "mock-broker"}})
    assert created.status_code == 201
    integration = created.json()
    assert integration["domain"] == "mqtt"

    discovery = await auth_client.get(f"/api/integrations/{integration['id']}/discovery")
    assert discovery.status_code == 200
    discovered = discovery.json()
    assert [item["discovered_id"] for item in discovered] == [
        "mqtt.living_room_strip",
        "mqtt.garage_relay",
        "mqtt.office_sensor",
        "mqtt.hallway_motion",
        "mqtt.hallway_lux",
        "mqtt.main_energy_meter",
    ]
    strip = discovered[0]["entities"][0]
    assert strip["entity_id"] == "light.mqtt_living_room_strip"
    assert strip["platform"] == "mqtt"
    assert strip["attributes"]["command_topic"] == "home/living_room/strip/set"
    assert strip["attributes"]["brightness_state_topic"] == "home/living_room/strip/brightness/state"
    sensor_entities = discovered[2]["entities"]
    assert sensor_entities[0]["attributes"]["state_topic"] == "home/office/sensor/temperature/state"
    assert sensor_entities[1]["device_class"] == "humidity"

    imported = await auth_client.post(
        f"/api/integrations/{integration['id']}/import",
        json={"discovered_ids": ["mqtt.living_room_strip", "mqtt.garage_relay"]},
    )
    assert imported.status_code == 200
    import_body = imported.json()
    assert import_body["imported"] == 2
    assert import_body["skipped"] == []

    linked_devices = (
        await db_session.execute(select(func.count(Device.id)).where(Device.integration_id == integration["id"]))
    ).scalar_one()
    linked_entities = (
        await db_session.execute(
            select(Entity).where(Entity.entity_id.in_(["light.mqtt_living_room_strip", "switch.mqtt_garage_relay"])).order_by(Entity.entity_id)
        )
    ).scalars().all()
    initial_states = (
        await db_session.execute(
            select(func.count(EntityState.id)).where(EntityState.entity_id.in_(["light.mqtt_living_room_strip", "switch.mqtt_garage_relay"]))
        )
    ).scalar_one()
    assert linked_devices == 2
    assert [entity.platform for entity in linked_entities] == ["mqtt", "mqtt"]
    assert linked_entities[0].attributes_json["state_topic"] == "home/living_room/strip/state"
    assert initial_states == 2

    light_action = await auth_client.post(
        "/api/actions/call",
        json={
            "domain": "light",
            "action": "turn_on",
            "target": {"entity_id": "light.mqtt_living_room_strip"},
            "data": {"brightness": 55},
        },
    )
    assert light_action.status_code == 200
    assert light_action.json()["new_state"] == "on"
    assert light_action.json()["attributes"]["brightness"] == 55
    assert light_action.json()["attributes"]["command_topic"] == "home/living_room/strip/set"

    switch_action = await auth_client.post(
        "/api/actions/call",
        json={"domain": "switch", "action": "turn_on", "target": {"entity_id": "switch.mqtt_garage_relay"}},
    )
    assert switch_action.status_code == 200
    assert switch_action.json()["new_state"] == "on"

    repeated = await auth_client.post(
        f"/api/integrations/{integration['id']}/import",
        json={"discovered_ids": ["mqtt.living_room_strip", "mqtt.garage_relay"]},
    )
    assert repeated.status_code == 200
    repeat_body = repeated.json()
    assert repeat_body["imported"] == 0
    assert len(repeat_body["skipped"]) == 2
    assert {item["reason"] for item in repeat_body["skipped"]} == {"already_imported"}


async def test_integration_import_validation_errors(auth_client: AsyncClient) -> None:
    unsupported = await auth_client.post("/api/integrations", json={"name": "Zigbee", "domain": "zigbee"})
    assert unsupported.status_code == 400
    assert unsupported.json() == {"error": "bad_request", "message": "Unsupported integration domain"}

    created = await auth_client.post("/api/integrations", json={"name": "MQTT Broker", "domain": "mqtt", "config": {"host": "mock-broker"}})
    assert created.status_code == 201
    integration_id = created.json()["id"]

    unknown = await auth_client.post(f"/api/integrations/{integration_id}/import", json={"discovered_ids": ["mqtt.missing"]})
    assert unknown.status_code == 400
    assert unknown.json() == {"error": "bad_request", "message": "Unknown discovered_id: mqtt.missing"}


async def test_create_custom_mqtt_device_updates_state_availability_and_publishes_commands(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    refresh = AsyncMock()
    publish = AsyncMock()
    monkeypatch.setattr(mqtt_client, "refresh_subscriptions", refresh)
    monkeypatch.setattr(mqtt_client, "publish", publish)

    created = await auth_client.post("/api/integrations", json={"name": "Custom MQTT", "domain": "mqtt"})
    integration_id = created.json()["id"]

    response = await auth_client.post(
        f"/api/integrations/{integration_id}/mqtt/devices",
        json={
            "name": "Presentation Lamp",
            "type": "light",
            "manufacturer": "homeIQ",
            "model": "MQTT-1",
            "entities": [
                {
                    "entity_id": "light.presentation_lamp",
                    "domain": "light",
                    "name": "Presentation Lamp",
                    "state": "off",
                    "state_topic": "demo/presentation/lamp/state",
                    "command_topic": "demo/presentation/lamp/set",
                    "availability_topic": "demo/presentation/lamp/availability",
                    "brightness_state_topic": "demo/presentation/lamp/brightness/state",
                    "brightness_command_topic": "demo/presentation/lamp/brightness/set",
                    "attributes": {"brightness": 0},
                }
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Presentation Lamp"
    assert body["entities"][0]["attributes"]["state_topic"] == "demo/presentation/lamp/state"
    assert body["entities"][0]["attributes"]["command_topic"] == "demo/presentation/lamp/set"
    refresh.assert_awaited_once()

    await handle_mqtt_state_message(db_session, "demo/presentation/lamp/brightness/state", "77")
    await handle_mqtt_state_message(db_session, "demo/presentation/lamp/availability", "offline")

    entity = (await db_session.execute(select(Entity).where(Entity.entity_id == "light.presentation_lamp"))).scalar_one()
    device = (await db_session.execute(select(Device).where(Device.id == entity.device_id))).scalar_one()
    assert entity.state == "on"
    assert entity.attributes_json["brightness"] == 77
    assert device.status == "offline"

    await db_session.commit()

    action = await auth_client.post(
        "/api/actions/call",
        json={"domain": "light", "action": "turn_on", "target": {"entity_id": "light.presentation_lamp"}, "data": {"brightness": 88}},
    )

    assert action.status_code == 200
    publish.assert_any_await("demo/presentation/lamp/set", "on")
    publish.assert_any_await("demo/presentation/lamp/brightness/set", "88")


async def test_create_custom_mqtt_device_validation_errors(auth_client: AsyncClient) -> None:
    demo = await auth_client.post("/api/integrations", json={"name": "Demo", "domain": "demo"})
    mqtt = await auth_client.post("/api/integrations", json={"name": "MQTT", "domain": "mqtt"})

    payload = {
        "name": "Lamp",
        "type": "light",
        "entities": [
            {
                "entity_id": "light.validation_lamp",
                "domain": "light",
                "name": "Lamp",
                "state_topic": "demo/lamp/state",
                "command_topic": "demo/lamp/set",
            }
        ],
    }

    non_mqtt = await auth_client.post(f"/api/integrations/{demo.json()['id']}/mqtt/devices", json=payload)
    assert non_mqtt.status_code == 400

    duplicate = await auth_client.post(
        f"/api/integrations/{mqtt.json()['id']}/mqtt/devices",
        json={
            **payload,
            "entities": [
                payload["entities"][0],
                {**payload["entities"][0], "name": "Lamp Duplicate"},
            ],
        },
    )
    assert duplicate.status_code == 400
    assert duplicate.json()["message"] == "Duplicate entity_id: light.validation_lamp"

    wildcard = await auth_client.post(
        f"/api/integrations/{mqtt.json()['id']}/mqtt/devices",
        json={**payload, "entities": [{**payload["entities"][0], "entity_id": "light.wildcard", "state_topic": "demo/+/state"}]},
    )
    assert wildcard.status_code == 400
    assert "wildcards" in wildcard.json()["message"]

    missing_command = await auth_client.post(
        f"/api/integrations/{mqtt.json()['id']}/mqtt/devices",
        json={**payload, "entities": [{**payload["entities"][0], "entity_id": "light.no_command", "command_topic": None}]},
    )
    assert missing_command.status_code == 400
    assert "command_topic is required" in missing_command.json()["message"]

    empty_entities = await auth_client.post(f"/api/integrations/{mqtt.json()['id']}/mqtt/devices", json={**payload, "entities": []})
    assert empty_entities.status_code == 422


async def test_mqtt_state_message_updates_imported_entities_and_writes_events(
    auth_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    created = await auth_client.post("/api/integrations", json={"name": "MQTT Broker", "domain": "mqtt", "config": {"host": "mock-broker"}})
    assert created.status_code == 201
    integration_id = created.json()["id"]

    imported = await auth_client.post(
        f"/api/integrations/{integration_id}/import",
        json={"discovered_ids": ["mqtt.living_room_strip", "mqtt.office_sensor"]},
    )
    assert imported.status_code == 200

    before_states = (
        await db_session.execute(select(func.count(EntityState.id)).where(EntityState.entity_id == "light.mqtt_living_room_strip"))
    ).scalar_one()

    await handle_mqtt_state_message(db_session, "home/living_room/strip/brightness/state", "60")
    await handle_mqtt_state_message(db_session, "home/office/sensor/temperature/state", "24.8")
    await handle_mqtt_state_message(db_session, "home/living_room/strip/availability", "offline")

    light = (
        await db_session.execute(select(Entity).where(Entity.entity_id == "light.mqtt_living_room_strip"))
    ).scalar_one()
    temp_sensor = (
        await db_session.execute(select(Entity).where(Entity.entity_id == "sensor.mqtt_office_temperature"))
    ).scalar_one()
    device = (await db_session.execute(select(Device).where(Device.id == light.device_id))).scalar_one()
    after_states = (
        await db_session.execute(select(func.count(EntityState.id)).where(EntityState.entity_id == "light.mqtt_living_room_strip"))
    ).scalar_one()
    mqtt_event = (
        await db_session.execute(
            select(Event)
            .where(Event.entity_id == "light.mqtt_living_room_strip", Event.source == "mqtt", Event.new_state == "on")
            .order_by(Event.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    assert light.state == "on"
    assert light.attributes_json["brightness"] == 60
    assert temp_sensor.state == "24.8"
    assert device.status == "offline"
    assert after_states == before_states + 1
    assert mqtt_event is not None


async def test_mqtt_energy_messages_create_live_readings(auth_client: AsyncClient, db_session: AsyncSession) -> None:
    power_before = (
        await db_session.execute(select(func.count(EnergyReading.id)).where(EnergyReading.entity_id == "sensor.main_energy_power"))
    ).scalar_one()
    total_before = (
        await db_session.execute(select(func.count(EnergyReading.id)).where(EnergyReading.entity_id == "sensor.main_energy_total"))
    ).scalar_one()

    await handle_mqtt_state_message(db_session, "home/hallway/meter/power/state", "600")
    await handle_mqtt_state_message(db_session, "home/hallway/meter/total/state", "10.5")
    await handle_mqtt_state_message(db_session, "home/hallway/meter/power/state", "1200")
    await handle_mqtt_state_message(db_session, "home/hallway/meter/total/state", "10.8")

    power_after = (
        await db_session.execute(select(func.count(EnergyReading.id)).where(EnergyReading.entity_id == "sensor.main_energy_power"))
    ).scalar_one()
    total_after = (
        await db_session.execute(select(func.count(EnergyReading.id)).where(EnergyReading.entity_id == "sensor.main_energy_total"))
    ).scalar_one()
    latest_total = (
        await db_session.execute(
            select(EnergyReading).where(EnergyReading.entity_id == "sensor.main_energy_total").order_by(EnergyReading.recorded_at.desc()).limit(1)
        )
    ).scalar_one()

    assert power_after == power_before + 2
    assert total_after == total_before + 2
    assert latest_total.energy_kwh == 0.3
    assert latest_total.power_w == 1200.0

    await db_session.commit()

    summary = await auth_client.get("/api/energy/summary")
    consumption = await auth_client.get("/api/energy/consumption")

    assert summary.status_code == 200
    assert summary.json()["current_power_w"] == 1200.0
    assert summary.json()["total_kwh"] >= 0
    assert consumption.status_code == 200
    assert consumption.json()["data"]


async def test_contract_nullable_fields_and_date_serialization(auth_client: AsyncClient) -> None:
    created = await auth_client.post("/api/devices", json={"name": "Loose Sensor", "type": "sensor"})

    assert created.status_code == 201
    device = created.json()
    assert device["area_id"] is None
    assert device["area_name"] is None
    assert device["manufacturer"] is None
    assert device["model"] is None
    assert device["name_by_user"] is None
    assert "T" in device["created_at"]

    entity = device["entities"][0]
    assert entity["area_id"] is None
    assert entity["unit_of_measurement"] == ""
    assert entity["device_class"] is None
    assert "T" in entity["last_changed"]


async def test_seeded_energy_and_ml_endpoints_are_non_empty(auth_client: AsyncClient) -> None:
    summary = await auth_client.get("/api/energy/summary")
    consumption = await auth_client.get("/api/energy/consumption", params={"period": "day", "granularity": "hour"})
    devices = await auth_client.get("/api/energy/devices")
    forecast = await auth_client.get("/api/energy/forecast")
    anomalies = await auth_client.get("/api/ml/anomalies", params={"period": "day", "limit": 100})

    assert summary.status_code == 200
    assert summary.json()["total_kwh"] > 0
    assert summary.json()["current_power_w"] > 0

    assert consumption.status_code == 200
    assert len(consumption.json()["data"]) > 0

    assert devices.status_code == 200
    assert len(devices.json()) > 0

    assert forecast.status_code == 200
    assert len(forecast.json()["forecast"]) > 0

    assert anomalies.status_code == 200
    anomaly_body = anomalies.json()
    assert anomaly_body["summary"]["total"] > 0
    assert len(anomaly_body["timeline"]) > 0
    assert len(anomaly_body["anomalies"]) > 0


async def test_action_call_writes_state_history_and_event(auth_client: AsyncClient, db_session: AsyncSession) -> None:
    response = await auth_client.post(
        "/api/actions/call",
        json={"domain": "light", "action": "turn_on", "target": {"entity_id": "light.hallway"}, "data": {"brightness": 70}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["new_state"] == "on"
    assert body["attributes"]["brightness"] == 70

    states = (
        await db_session.execute(select(func.count(EntityState.id)).where(EntityState.entity_id == "light.hallway", EntityState.state == "on"))
    ).scalar_one()
    event = (
        await db_session.execute(
            select(Event).where(Event.entity_id == "light.hallway", Event.new_state == "on", Event.source == "user").order_by(Event.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    assert states >= 1
    assert event is not None


async def test_motion_trigger_runs_hallway_automation(auth_client: AsyncClient, db_session: AsyncSession) -> None:
    response = await auth_client.patch("/api/entities/binary_sensor.hallway_motion/state", json={"state": "on"})

    assert response.status_code == 200
    hallway = (await db_session.execute(select(Entity).where(Entity.entity_id == "light.hallway"))).scalar_one()
    run_count = (await db_session.execute(select(func.count(AutomationRun.id)))).scalar_one()
    automation_event = (
        await db_session.execute(
            select(Event).where(Event.event_type == "automation_triggered", Event.source == "automation").order_by(Event.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    state_event = (
        await db_session.execute(
            select(Event).where(Event.entity_id == "light.hallway", Event.source == "automation", Event.new_state == "on").order_by(Event.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()

    assert hallway.state == "on"
    assert hallway.attributes_json["brightness"] == 80
    assert run_count == 1
    assert automation_event is not None
    assert state_event is not None
    assert automation_event.metadata_json == {"triggered_by": "state_changed:binary_sensor.hallway_motion"}


async def test_events_contract_pagination_and_serialization(auth_client: AsyncClient) -> None:
    await auth_client.patch("/api/entities/light.hallway/state", json={"state": "on"})
    await auth_client.patch("/api/entities/light.hallway/state", json={"state": "off"})

    page = await auth_client.get("/api/events", params={"entity_id": "light.hallway", "limit": 1, "offset": 1})
    clamped = await auth_client.get("/api/events", params={"limit": 999, "offset": -5})

    assert page.status_code == 200
    body = page.json()
    assert body["total"] >= 2
    assert body["limit"] == 1
    assert body["offset"] == 1
    assert len(body["events"]) == 1
    event = body["events"][0]
    assert {"id", "entity_id", "event_type", "old_state", "new_state", "source", "user_id", "automation_id", "metadata", "created_at"} == set(event)
    assert "T" in event["created_at"]

    assert clamped.status_code == 200
    assert clamped.json()["limit"] == 200
    assert clamped.json()["offset"] == 0


async def test_energy_endpoints_return_expected_fields(auth_client: AsyncClient) -> None:
    summary = await auth_client.get("/api/energy/summary")
    consumption = await auth_client.get("/api/energy/consumption")
    devices = await auth_client.get("/api/energy/devices")
    forecast = await auth_client.get("/api/energy/forecast")

    assert summary.status_code == 200
    assert {"period", "total_kwh", "total_cost", "currency", "current_power_w", "peak_power_w", "device_count", "date_from", "date_to"} <= set(summary.json())
    assert summary.json()["current_power_w"] >= 0
    assert consumption.status_code == 200
    assert {"period", "granularity", "data"} <= set(consumption.json())
    if consumption.json()["data"]:
        assert {"timestamp", "kwh", "power_w"} <= set(consumption.json()["data"][0])
    assert devices.status_code == 200
    if devices.json():
        assert {"entity_id", "device_name", "kwh", "current_power_w", "percentage", "anomaly"} <= set(devices.json()[0])
    assert forecast.status_code == 200
    assert {"period_hours", "forecast", "total_predicted_kwh", "confidence"} <= set(forecast.json())


async def test_ml_anomalies_endpoint_contract(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/api/ml/anomalies", params={"period": "day", "limit": 50})

    assert response.status_code == 200
    body = response.json()
    assert body["model"]["name"] == "IsolationForest"
    assert body["model"]["confidence"] == "ml"
    assert body["summary"]["total"] >= 0
    assert body["summary"]["anomalies"] >= 0
    assert body["summary"]["anomalies"] <= body["summary"]["total"]
    assert len(body["timeline"]) == body["summary"]["total"]
    if body["anomalies"]:
        assert {"id", "entity_id", "device_name", "recorded_at", "power_w", "energy_kwh", "anomaly_score", "severity", "reason"} <= set(
            body["anomalies"][0]
        )
