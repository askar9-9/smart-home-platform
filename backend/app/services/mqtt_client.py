"""MQTT client service for homeIQ.

Subscribes to device state topics and updates entities in the database.
Publishes commands to MQTT when actions are called on MQTT-platform devices.

Topic convention (matches integration catalog in integrations.py):
    home/{room}/{device}/state              — device reports state (on/off)
    home/{room}/{device}/set                — platform sends command
    home/{room}/{device}/brightness/state   — device reports brightness
    home/{room}/{device}/{metric}/state     — device reports power/energy/sensor readings
    home/{room}/{device}/brightness/set     — platform sends brightness
    home/{room}/{device}/availability       — device reports online/offline
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import aiomqtt
from sqlalchemy import select

from app.config import settings

logger = logging.getLogger(__name__)

_BACKOFF_INITIAL = 1.0
_BACKOFF_FACTOR = 2.0
_BACKOFF_MAX = 30.0

_SUBSCRIPTION_TOPICS = [
    "home/+/+/state",
    "home/+/+/+/state",
    "home/+/+/brightness/state",
    "home/+/+/availability",
]


def mqtt_subscription_topics(entities: list[Any]) -> set[str]:
    topics: set[str] = set()
    for entity in entities:
        attrs = entity.attributes_json or {}
        for key, value in attrs.items():
            if not isinstance(value, str):
                continue
            if key in {"state_topic", "availability_topic"} or key.endswith("_state_topic"):
                topics.add(value)
    return topics


class MQTTClient:
    """Async MQTT client that bridges Mosquitto and the platform event bus."""

    def __init__(self) -> None:
        self._client: aiomqtt.Client | None = None
        self._running = False
        self._connected = False
        self._subscribed_topics: set[str] = set()

    @property
    def connected(self) -> bool:
        return self._connected and self._client is not None

    async def start(self) -> None:
        """Connect to the MQTT broker and keep reconnecting with exponential backoff.

        Runs a loop that connects, subscribes, listens, and on disconnect/error
        waits with exponential backoff before reconnecting.  Only stops on
        explicit :meth:`stop` (cancellation).
        """
        if not settings.mqtt_enabled:
            logger.info("MQTT disabled, skipping connection")
            return

        self._running = True
        backoff = _BACKOFF_INITIAL

        while self._running:
            try:
                self._client = aiomqtt.Client(
                    hostname=settings.mqtt_host,
                    port=settings.mqtt_port,
                    username=settings.mqtt_username,
                    password=settings.mqtt_password,
                )
                await self._client.__aenter__()
                self._connected = True
                self._subscribed_topics = set()
                logger.info("MQTT connected to %s:%s", settings.mqtt_host, settings.mqtt_port)

                # Subscribe to all topics
                for topic in _SUBSCRIPTION_TOPICS:
                    await self._client.subscribe(topic)
                    self._subscribed_topics.add(topic)
                    logger.info("MQTT subscribed to %s", topic)
                await self.refresh_subscriptions()

                # Reset backoff on successful connection
                backoff = _BACKOFF_INITIAL

                # Listen for messages — exits on disconnect/error
                try:
                    async for message in self._client.messages:
                        await self._handle_message(message)
                except aiomqtt.MqttError:
                    logger.warning("MQTT connection lost, will reconnect")

            except asyncio.CancelledError:
                # Graceful shutdown requested
                logger.info("MQTT client cancelled, shutting down")
                raise
            except Exception:
                logger.exception("MQTT connection error, will reconnect")

            # Clean up the client before reconnecting
            if self._client is not None:
                try:
                    await self._client.__aexit__(None, None, None)
                except Exception:
                    pass
                self._client = None
                self._connected = False

            if not self._running:
                break

            logger.info("MQTT reconnecting in %.0fs", backoff)
            try:
                await asyncio.sleep(backoff)
            except asyncio.CancelledError:
                logger.info("MQTT client cancelled during backoff, shutting down")
                raise

            backoff = min(backoff * _BACKOFF_FACTOR, _BACKOFF_MAX)

    async def stop(self) -> None:
        """Disconnect from the MQTT broker."""
        self._running = False
        if self._client is not None:
            try:
                await self._client.__aexit__(None, None, None)
            except Exception:
                pass
            self._client = None
            self._connected = False
            logger.info("MQTT disconnected")

    async def publish(self, topic: str, payload: str | dict, retain: bool = False) -> None:
        """Publish a message to an MQTT topic."""
        if self._client is None:
            return
        if isinstance(payload, dict):
            payload = json.dumps(payload)
        try:
            await self._client.publish(topic, payload=payload, retain=retain)
            logger.debug("MQTT publish → %s: %s", topic, payload)
        except Exception:
            logger.warning("MQTT publish failed for topic %s", topic)

    async def refresh_subscriptions(self) -> None:
        """Subscribe to exact MQTT state topics configured on imported devices."""
        if self._client is None:
            return

        from app.database import SessionLocal
        from app.models import Entity

        async with SessionLocal() as db:
            rows = (await db.execute(select(Entity).where(Entity.platform == "mqtt"))).scalars().all()

        topics = mqtt_subscription_topics(rows)

        for topic in sorted(topics):
            if topic in self._subscribed_topics:
                continue
            try:
                await self._client.subscribe(topic)
                self._subscribed_topics.add(topic)
                logger.info("MQTT subscribed to configured topic %s", topic)
            except Exception:
                logger.warning("MQTT dynamic subscribe failed for %s", topic)

    async def _handle_message(self, message: aiomqtt.Message) -> None:
        """Route an incoming MQTT message to the appropriate handler."""
        topic = str(message.topic)
        payload = message.payload.decode() if isinstance(message.payload, bytes) else str(message.payload)
        logger.info("MQTT ← %s: %s", topic, payload)

        # Import here to avoid circular imports and to get a fresh session
        from app.database import SessionLocal
        from app.services.mqtt_handler import handle_mqtt_state_message

        async with SessionLocal() as db:
            try:
                await handle_mqtt_state_message(db, topic, payload)
                await db.commit()
            except Exception:
                logger.exception("Error handling MQTT message on %s", topic)
                await db.rollback()


mqtt_client = MQTTClient()
