"""MQTT message handler — routes incoming MQTT messages to entity state updates.

When a device publishes to a state topic (e.g. home/living_room/strip/state),
this handler finds the matching entity in the database and updates its state
through the same set_entity_state() path used by the REST API, ensuring
consistency with events, automations, and SSE notifications.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, Entity
from app.services.energy_ingest import coerce_numeric_value, record_energy_reading
from app.services.entities import set_entity_state

logger = logging.getLogger(__name__)

# Pattern: home/{room}/{device}/state
# Pattern: home/{room}/{device}/{property}/state
_STATE_TOPIC_RE = re.compile(r"^home/([^/]+)/([^/]+)(?:/([^/]+))?/state$")
_AVAILABILITY_TOPIC_RE = re.compile(r"^home/([^/]+)/([^/]+)/availability$")

_MAX_PAYLOAD_LENGTH = 255


def _parse_state_topic(topic: str) -> tuple[str, str, str | None] | None:
    """Extract (room, device, property) from a state topic.

    Returns None if the topic doesn't match the expected pattern.
    """
    m = _STATE_TOPIC_RE.match(topic)
    if m is None:
        return None
    return m.group(1), m.group(2), m.group(3)


def _parse_availability_topic(topic: str) -> tuple[str, str] | None:
    """Extract (room, device) from an availability topic."""
    m = _AVAILABILITY_TOPIC_RE.match(topic)
    if m is None:
        return None
    return m.group(1), m.group(2)


async def _find_entity_by_state_topic(db: AsyncSession, topic: str) -> Entity | None:
    """Find an entity whose state_topic (or *_state_topic) attribute matches the incoming topic.

    Uses a JSONB query to push the search into PostgreSQL rather than loading
    all entities into Python.
    """
    # Primary: exact match on state_topic via JSONB
    stmt = select(Entity).where(Entity.attributes_json["state_topic"].astext == topic)
    result = await db.execute(stmt)
    entity = result.scalar_one_or_none()
    if entity is not None:
        return entity

    # Secondary: match on any *_state_topic key (brightness_state_topic, etc.)
    mqtt_entities = (await db.execute(
        select(Entity).where(Entity.platform == "mqtt")
    )).scalars().all()

    for e in mqtt_entities:
        attrs = e.attributes_json or {}
        for key, value in attrs.items():
            if key.endswith("_state_topic") and value == topic:
                return e

    return None


def _property_for_exact_topic(entity: Entity, topic: str) -> str | None:
    attrs = entity.attributes_json or {}
    if attrs.get("state_topic") == topic:
        return None
    for key, value in attrs.items():
        if key.endswith("_state_topic") and value == topic:
            return key.removesuffix("_state_topic")
    return None


async def _find_entity_by_availability_topic(db: AsyncSession, topic: str) -> Entity | None:
    stmt = select(Entity).where(Entity.attributes_json["availability_topic"].astext == topic)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _find_entity_by_room_and_slug(db: AsyncSession, room: str, slug: str) -> Entity | None:
    """Try to find an entity by room/slug path from topic.

    Falls back to matching entity_id pattern: domain.mqtt_room_slug
    """
    # Try matching on command_topic/state_topic containing room/slug fragment
    mqtt_entities = (await db.execute(
        select(Entity).where(Entity.platform == "mqtt")
    )).scalars().all()

    for entity in mqtt_entities:
        attrs = entity.attributes_json or {}
        for key in ("state_topic", "command_topic"):
            topic_val = attrs.get(key, "")
            if topic_val and f"{room}/{slug}" in topic_val:
                return entity

    # Fallback: look for entity_id matching pattern
    # e.g. "light.mqtt_living_room_strip" for topic "home/living_room/strip"
    entity_prefix = f"mqtt_{room}_{slug}".replace("-", "_")
    for entity in mqtt_entities:
        if entity.entity_id.endswith(entity_prefix):
            return entity

    return None


async def handle_mqtt_state_message(db: AsyncSession, topic: str, payload: str) -> None:
    """Process an incoming MQTT message and update entity state.

    Topic routing:
        home/{room}/{device}/state              → entity.state = payload
        home/{room}/{device}/brightness/state    → entity.attributes.brightness = payload
        home/{room}/{device}/temperature/state    → entity.state = payload (sensor)
        home/{room}/{device}/humidity/state       → entity.state = payload (sensor)
        home/{room}/{device}/availability          → device.status = payload
    """
    # Payload validation
    payload = payload.strip()
    if not payload:
        logger.warning("Empty MQTT payload on topic %s, ignoring", topic)
        return
    if len(payload) > _MAX_PAYLOAD_LENGTH:
        logger.warning("MQTT payload too long (%d chars) on topic %s, truncating", len(payload), topic)
        payload = payload[:_MAX_PAYLOAD_LENGTH]

    availability_entity = await _find_entity_by_availability_topic(db, topic)
    if availability_entity is not None:
        await _set_device_status(db, availability_entity, payload)
        return

    exact_entity = await _find_entity_by_state_topic(db, topic)

    # Check if this is an availability topic
    avail_match = _parse_availability_topic(topic)
    if avail_match is not None:
        await _handle_availability(db, avail_match, payload)
        return

    # Parse state topic
    parsed = _parse_state_topic(topic)
    if parsed is None and exact_entity is None:
        logger.warning("Unrecognized MQTT topic: %s", topic)
        return

    room, slug, prop = parsed if parsed is not None else ("", "", None)

    # Find matching entity — first by exact topic attribute, then by naming convention
    entity = exact_entity
    if entity is None and parsed is not None:
        entity = await _find_entity_by_room_and_slug(db, room, slug)
    if entity is None:
        logger.warning("No entity found for MQTT topic %s", topic)
        return
    if parsed is None:
        prop = _property_for_exact_topic(entity, topic)

    # Determine new state and attributes based on the property
    previous_state = entity.state
    new_state: str = entity.state
    new_attrs: dict[str, Any] = dict(entity.attributes_json or {})

    if prop is None:
        # Main state topic — payload is the state value (e.g. "on", "off", "22.4")
        new_state = payload
    elif prop == "brightness":
        # Brightness state update
        try:
            new_attrs["brightness"] = int(payload)
        except ValueError:
            new_attrs["brightness"] = payload
        # If brightness > 0, device should be on
        if new_state == "off" and new_attrs.get("brightness", 0) > 0:
            new_state = "on"
    elif prop in ("temperature", "humidity", "power", "total"):
        # Sensor reading — update state with the value
        new_state = payload
    else:
        # Unknown property — store in attributes
        new_attrs[prop] = payload

    await set_entity_state(db, entity, new_state, new_attrs, source="mqtt")
    numeric_state = coerce_numeric_value(new_state)
    if numeric_state is not None and entity.device_class in {"power", "energy"}:
        await record_energy_reading(db, entity, numeric_state, previous_state=previous_state)
    logger.info("MQTT updated %s: state=%s attrs=%s", entity.entity_id, new_state, list(new_attrs.keys()))


async def _handle_availability(db: AsyncSession, room_slug: tuple[str, str], payload: str) -> None:
    """Handle device availability messages (online/offline)."""
    room, slug = room_slug

    # Validate payload length for availability too
    # (already truncated in caller, but the status is derived from payload)

    # Find entity by room/slug, then look up its device
    entity = await _find_entity_by_room_and_slug(db, room, slug)
    if entity is None:
        logger.warning("No entity found for availability topic: %s/%s", room, slug)
        return

    await _set_device_status(db, entity, payload)


async def _set_device_status(db: AsyncSession, entity: Entity, payload: str) -> None:
    status = "online" if payload.lower() in ("online", "on", "1", "true") else "offline"
    if entity.device_id is not None:
        device = (await db.execute(select(Device).where(Device.id == entity.device_id))).scalar_one_or_none()
    else:
        device = None

    if device is None:
        logger.warning("No device found for availability topic on entity %s", entity.entity_id)
        return

    device.status = status
    logger.info("MQTT device %s availability: %s", device.name, status)
