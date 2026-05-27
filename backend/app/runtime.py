from __future__ import annotations

import asyncio
import math
from collections.abc import Awaitable, Callable
from contextlib import suppress
from datetime import UTC, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import SessionLocal, engine
from app.models import Entity
from app.seed import seed_database
from app.services.energy_ingest import demo_power_profile
from app.services.mqtt_client import mqtt_client


RUNTIME_LOCAL_GUIDANCE = (
    "For local backend development, start Docker infra with "
    "`docker compose up -d postgres mosquitto`, copy "
    "`backend/.env.local.example` to `backend/.env`, then run `cd backend && ./scripts/dev.sh`."
)


async def simulator() -> None:
    total_energy_kwh: float | None = None
    motion_state = "off"
    while True:
        await asyncio.sleep(30)
        async with SessionLocal() as db:
            total_energy_kwh, motion_state = await simulate_demo_mqtt_cycle(
                db,
                total_energy_kwh=total_energy_kwh,
                motion_state=motion_state,
            )
            await db.commit()


async def simulate_demo_mqtt_cycle(
    db,
    *,
    total_energy_kwh: float | None = None,
    motion_state: str = "off",
    recorded_at: datetime | None = None,
) -> tuple[float, str]:
    from app.services.mqtt_handler import handle_mqtt_state_message

    recorded_at = recorded_at or datetime.now(UTC)
    power_w = demo_power_profile(recorded_at)
    if total_energy_kwh is None:
        total_entity = (
            await db.execute(select(Entity).where(Entity.entity_id == "sensor.main_energy_total"))
        ).scalar_one_or_none()
        total_energy_kwh = float(total_entity.state) if total_entity is not None and total_entity.state else 0.0
    total_energy_kwh = round(total_energy_kwh + power_w * (30 / 3600) / 1000, 3)

    phase = recorded_at.hour + recorded_at.minute / 60
    living_temperature = round(22 + math.sin(phase / 24 * math.tau) * 1.8, 1)
    kitchen_temperature = round(23 + math.cos(phase / 24 * math.tau) * 1.4, 1)
    humidity = round(42 + math.sin(phase / 12 * math.tau) * 6, 1)
    lux = 18 if recorded_at.hour >= 19 or recorded_at.hour < 6 else 65
    should_trigger_motion = recorded_at.minute % 3 == 0 and recorded_at.second < 30
    next_motion_state = "on" if should_trigger_motion and motion_state == "off" else "off"

    for topic, payload in (
        ("home/living_room/sensor/temperature/state", f"{living_temperature:.1f}"),
        ("home/kitchen/sensor/temperature/state", f"{kitchen_temperature:.1f}"),
        ("home/kitchen/sensor/humidity/state", f"{humidity:.1f}"),
        ("home/hallway/lux/state", str(lux)),
        ("home/hallway/motion/state", next_motion_state),
        ("home/hallway/meter/power/state", f"{power_w:.2f}"),
        ("home/hallway/meter/total/state", f"{total_energy_kwh:.3f}"),
    ):
        await handle_mqtt_state_message(db, topic, payload)

    return total_energy_kwh, next_motion_state


def _alembic_config() -> Config:
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


def _format_database_error(exc: BaseException) -> RuntimeError:
    message = str(exc)
    reason = "database is unavailable"
    lowered = message.lower()
    if "connection refused" in lowered or "connect call failed" in lowered or "could not connect" in lowered:
        reason = "database connection was refused"
    elif 'role "smart_home" does not exist' in message:
        reason = 'database role "smart_home" does not exist'
    elif 'database "smart_home" does not exist' in message:
        reason = 'database "smart_home" does not exist'

    return RuntimeError(f"Backend startup failed: {reason}. {RUNTIME_LOCAL_GUIDANCE}")


async def ensure_database_ready() -> None:
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise _format_database_error(exc) from exc


async def run_migrations() -> None:
    await asyncio.to_thread(command.upgrade, _alembic_config(), "head")


async def seed_runtime_database() -> None:
    async with SessionLocal() as db:
        await seed_database(db)


async def prepare_runtime(
    *,
    ensure_database_ready_fn: Callable[[], Awaitable[None]] = ensure_database_ready,
    run_migrations_fn: Callable[[], Awaitable[None]] = run_migrations,
    seed_database_fn: Callable[[], Awaitable[None]] = seed_runtime_database,
) -> None:
    await ensure_database_ready_fn()
    if settings.run_migrations_on_start:
        await run_migrations_fn()
    if settings.seed_enabled:
        await seed_database_fn()


async def start_background_tasks() -> tuple[asyncio.Task[None] | None, asyncio.Task[None] | None]:
    sim_task = asyncio.create_task(simulator()) if settings.sim_enabled else None
    mqtt_task = asyncio.create_task(mqtt_client.start()) if settings.mqtt_enabled else None
    return sim_task, mqtt_task


async def stop_background_tasks(
    sim_task: asyncio.Task[None] | None,
    mqtt_task: asyncio.Task[None] | None,
) -> None:
    await mqtt_client.stop()
    if sim_task:
        sim_task.cancel()
        with suppress(asyncio.CancelledError):
            await sim_task
    if mqtt_task:
        mqtt_task.cancel()
        with suppress(asyncio.CancelledError):
            await mqtt_task
