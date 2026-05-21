#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080/api").rstrip("/")
USERNAME = os.environ.get("USERNAME", "testadmin")
PASSWORD = os.environ.get("PASSWORD", "testpass123")


def request_json(
    method: str,
    path: str,
    *,
    token: str | None = None,
    data: dict[str, Any] | None = None,
    expected: tuple[int, ...] = (200,),
) -> Any:
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, method=method)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as response:
            payload = response.read()
            status = response.getcode()
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        status = exc.code
        if status not in expected:
            text = payload.decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {path} -> {status}\n{text}") from exc
    if status not in expected:
        text = payload.decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> {status}\n{text}")
    if not payload:
        return None
    return json.loads(payload)


def login() -> str:
    payload = request_json(
        "POST",
        "/auth/login",
        data={"username": USERNAME, "password": PASSWORD},
    )
    return payload["access_token"]


def normalize_collection(payload: Any, key: str) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        value = payload.get(key)
        if isinstance(value, list):
            return value
    raise RuntimeError(f"Unexpected collection payload for key '{key}': {payload!r}")


def quote_entity_id(entity_id: str) -> str:
    return urllib.parse.quote(entity_id, safe="")


def find_by_name(items: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    for item in items:
        if item.get("name") == name:
            return item
    return None


def get_area_map(token: str) -> dict[str, dict[str, Any]]:
    areas = normalize_collection(request_json("GET", "/areas", token=token), "areas")
    return {area["name"]: area for area in areas}


def get_devices(token: str) -> list[dict[str, Any]]:
    return normalize_collection(request_json("GET", "/devices", token=token), "devices")


def get_entities(token: str) -> list[dict[str, Any]]:
    return normalize_collection(request_json("GET", "/entities", token=token), "entities")


def get_automations(token: str) -> list[dict[str, Any]]:
    return normalize_collection(request_json("GET", "/automations", token=token), "automations")


def get_device(token: str, device_id: str) -> dict[str, Any]:
    return request_json("GET", f"/devices/{device_id}", token=token)


def ensure_device(
    token: str,
    *,
    name: str,
    type_: str,
    area_id: str | None,
    manufacturer: str,
    model: str,
) -> dict[str, Any]:
    existing = find_by_name(get_devices(token), name)
    if existing is None:
        created = request_json(
            "POST",
            "/devices",
            token=token,
            data={
                "name": name,
                "type": type_,
                "area_id": area_id,
                "manufacturer": manufacturer,
                "model": model,
            },
            expected=(201,),
        )
        print(f"Created device: {name}")
        return created
    updated = request_json(
        "PATCH",
        f"/devices/{existing['id']}",
        token=token,
        data={
            "name": name,
            "area_id": area_id,
            "manufacturer": manufacturer,
            "model": model,
            "status": "online",
        },
    )
    print(f"Updated device: {name}")
    return updated


def ensure_automation(token: str, *, name: str, payload: dict[str, Any]) -> dict[str, Any]:
    existing = find_by_name(get_automations(token), name)
    if existing is None:
        created = request_json("POST", "/automations", token=token, data=payload, expected=(201,))
        print(f"Created automation: {name}")
        return created
    updated = request_json("PATCH", f"/automations/{existing['id']}", token=token, data=payload)
    print(f"Updated automation: {name}")
    return updated


def patch_entity_state(token: str, entity_id: str, *, state: str, attributes: dict[str, Any]) -> None:
    request_json(
        "PATCH",
        f"/entities/{quote_entity_id(entity_id)}/state",
        token=token,
        data={"state": state, "attributes": attributes},
    )
    print(f"Prepared entity state: {entity_id} -> {state}")


def main() -> int:
    token = login()
    areas = get_area_map(token)
    required_areas = {"Гостиная", "Кухня", "Спальня", "Коридор"}
    missing = sorted(required_areas - areas.keys())
    if missing:
        raise RuntimeError(f"Missing areas for demo setup: {', '.join(missing)}")

    hallway_lamp = ensure_device(
        token,
        name="DEMO Hallway Accent Lamp",
        type_="light",
        area_id=areas["Коридор"]["id"],
        manufacturer="Codex Demo",
        model="Accent Light A1",
    )
    coffee_plug = ensure_device(
        token,
        name="DEMO Kitchen Coffee Plug",
        type_="switch",
        area_id=areas["Кухня"]["id"],
        manufacturer="Codex Demo",
        model="Smart Plug S1",
    )
    power_meter = ensure_device(
        token,
        name="DEMO Kitchen Power Meter",
        type_="energy_meter",
        area_id=areas["Кухня"]["id"],
        manufacturer="Codex Demo",
        model="Energy Meter E1",
    )
    climate_panel = ensure_device(
        token,
        name="DEMO Bedroom Climate Panel",
        type_="climate",
        area_id=areas["Спальня"]["id"],
        manufacturer="Codex Demo",
        model="Climate Panel C1",
    )

    hallway_lamp_entity = hallway_lamp["entities"][0]["entity_id"]
    coffee_plug_entity = coffee_plug["entities"][0]["entity_id"]
    power_meter_entity = power_meter["entities"][0]["entity_id"]
    climate_panel_entity = climate_panel["entities"][0]["entity_id"]

    automation_name = "DEMO: Hallway motion turns on accent lamp"
    ensure_automation(
        token,
        name=automation_name,
        payload={
            "name": automation_name,
            "description": "Для демонстрации: включает DEMO Hallway Accent Lamp, когда в коридоре есть движение и темно.",
            "is_enabled": True,
            "mode": "single",
            "trigger": {
                "type": "state_changed",
                "entity_id": "binary_sensor.hallway_motion",
                "to": "on",
            },
            "condition": {
                "entity_id": "sensor.hallway_lux",
                "operator": "lt",
                "value": 30,
            },
            "action": {
                "domain": "light",
                "action": "turn_on",
                "target": {"entity_id": hallway_lamp_entity},
                "data": {"brightness": 75},
            },
        },
    )

    patch_entity_state(token, hallway_lamp_entity, state="off", attributes={"brightness": 0})
    patch_entity_state(token, coffee_plug_entity, state="off", attributes={})
    patch_entity_state(
        token,
        power_meter_entity,
        state="142",
        attributes={"friendly_name": "DEMO Kitchen Power Meter", "energy_meter": True},
    )
    patch_entity_state(
        token,
        climate_panel_entity,
        state="heat",
        attributes={
            "current_temperature": 21,
            "target_temperature": 23,
            "hvac_mode": "heat",
        },
    )

    summary = {
        "devices": [
            {
                "name": item["name"],
                "device_id": item["id"],
                "entity_id": item["entities"][0]["entity_id"],
            }
            for item in [hallway_lamp, coffee_plug, power_meter, climate_panel]
        ],
        "automation": automation_name,
        "demo_steps": [
            "Open /devices and show the four DEMO devices in Kitchen, Bedroom, and Hallway.",
            "Open /entities and verify the prepared states: lamp off, coffee plug off, power meter 142W, climate heat/23C.",
            "Open /automations and run 'DEMO: Hallway motion turns on accent lamp' manually, or switch binary_sensor.hallway_motion to on.",
            "Show that DEMO Hallway Accent Lamp turns on with brightness 75.",
        ],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover - script output only
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
