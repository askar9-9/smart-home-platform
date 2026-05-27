from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.entities import get_entity_or_404, set_entity_state

logger = logging.getLogger(__name__)


async def _publish_mqtt_command(entity: Any, domain: str, action: str, data: dict[str, Any], new_state: str) -> None:
    """Publish a command to MQTT for mqtt-platform entities.

    Only publishes if the entity has command topics in its attributes.
    This is a fire-and-forget operation — the actual state update
    will come back through the MQTT listener when the device confirms.
    """
    from app.services.mqtt_client import mqtt_client

    attrs = entity.attributes_json or {}

    # Only publish for mqtt-platform entities that have command topics
    command_topic = attrs.get("command_topic")
    if command_topic is None:
        return

    try:
        # Publish main command
        payload: str | dict
        if domain == "light":
            payload = new_state  # "on" or "off"
            await mqtt_client.publish(command_topic, payload)
            # Publish brightness command if applicable
            brightness_topic = attrs.get("brightness_command_topic")
            if brightness_topic and "brightness" in data:
                await mqtt_client.publish(brightness_topic, str(data["brightness"]))
        elif domain == "switch":
            payload = new_state  # "on" or "off"
            await mqtt_client.publish(command_topic, payload)
        elif domain == "climate":
            if action == "set_temperature":
                payload = data  # {"temperature": 22}
                await mqtt_client.publish(command_topic, payload)
            elif action == "set_mode":
                payload = data  # {"hvac_mode": "heat"}
                await mqtt_client.publish(command_topic, payload)
        else:
            payload = new_state
            await mqtt_client.publish(command_topic, payload)

        logger.info("MQTT command → %s: %s", command_topic, payload)
    except Exception:
        logger.exception("Failed to publish MQTT command for %s", entity.entity_id)


async def call_action(
    db: AsyncSession,
    domain: str,
    action: str,
    target: dict[str, Any],
    data: dict[str, Any] | None = None,
    *,
    source: str = "user",
    user_id: uuid.UUID | None = None,
    automation_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    entity_id = target.get("entity_id")
    if not entity_id:
        raise HTTPException(400, "target.entity_id is required")
    entity = await get_entity_or_404(db, entity_id)
    data = data or {}

    if domain in {"sensor", "energy_meter"} or entity.domain == "sensor" and action not in {"read"}:
        raise HTTPException(400, "Entity is read-only")
    if domain != entity.domain and not (domain == "energy_meter" and entity.device_class in {"power", "energy"}):
        raise HTTPException(400, "Domain does not match entity")

    if domain in {"light", "switch"}:
        if action == "turn_on":
            new_state = "on"
        elif action == "turn_off":
            new_state = "off"
        elif action == "toggle":
            new_state = "off" if entity.state == "on" else "on"
        else:
            raise HTTPException(400, "Unsupported action")
        attrs = {"brightness": data["brightness"]} if domain == "light" and "brightness" in data else {}
    elif domain == "climate":
        attrs = {}
        new_state = entity.state
        if action == "set_temperature":
            if "temperature" not in data:
                raise HTTPException(400, "temperature is required")
            attrs["target_temperature"] = data["temperature"]
        elif action == "set_mode":
            mode = data.get("hvac_mode") or data.get("mode")
            if mode not in {"heat", "cool", "off"}:
                raise HTTPException(400, "hvac_mode must be heat, cool, or off")
            attrs["hvac_mode"] = mode
            new_state = mode
        else:
            raise HTTPException(400, "Unsupported action")
    else:
        raise HTTPException(400, "Unsupported domain")

    await set_entity_state(db, entity, new_state, attrs, source=source, user_id=user_id, automation_id=automation_id)
    await db.commit()
    await db.refresh(entity)

    # Publish MQTT command if this is an MQTT-platform entity
    await _publish_mqtt_command(entity, domain, action, data or {}, new_state)

    return {"ok": True, "entity_id": entity.entity_id, "new_state": entity.state, "attributes": entity.attributes_json or {}}
