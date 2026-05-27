from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EnergyReading, Entity


def coerce_numeric_value(value: object) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def demo_power_profile(recorded_at: datetime) -> float:
    hour = recorded_at.hour
    weekday = recorded_at.weekday()
    if hour < 6:
        base = 140.0
    elif hour < 9:
        base = 320.0
    elif hour < 17:
        base = 480.0
    elif hour < 22:
        base = 760.0
    else:
        base = 260.0

    if weekday >= 5:
        base *= 0.9

    jitter = float(((recorded_at.toordinal() * 17) + (hour * 13)) % 60 - 30)
    if weekday == 2 and 19 <= hour <= 20:
        base += 980.0
    if weekday == 5 and hour == 14:
        base += 620.0
    if hour < 5 and weekday == 4:
        base += 680.0

    return round(max(base + jitter, 80.0), 2)


async def seed_demo_energy_history(
    db: AsyncSession,
    power_entity: Entity,
    total_entity: Entity,
    *,
    hours: int = 24 * 7,
) -> int:
    existing = (
        await db.execute(
            select(EnergyReading.id)
            .where(EnergyReading.entity_id.in_([power_entity.entity_id, total_entity.entity_id]))
            .limit(1)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return 0

    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    start = now - timedelta(hours=hours - 1)
    total_kwh = 0.0
    last_power = 0.0

    for index in range(hours):
        recorded_at = start + timedelta(hours=index)
        power_w = demo_power_profile(recorded_at)
        if index >= hours - 24 and recorded_at.hour in {19, 20}:
            power_w = round(power_w + 980.0, 2)
        delta_kwh = round(power_w / 1000, 6)
        total_kwh = round(total_kwh + delta_kwh, 6)
        last_power = power_w

        db.add(
            EnergyReading(
                entity_id=power_entity.entity_id,
                power_w=power_w,
                energy_kwh=delta_kwh,
                recorded_at=recorded_at,
            )
        )
        db.add(
            EnergyReading(
                entity_id=total_entity.entity_id,
                power_w=power_w,
                energy_kwh=delta_kwh,
                recorded_at=recorded_at,
            )
        )

    power_entity.state = str(round(last_power, 2))
    total_entity.state = str(round(total_kwh, 3))
    power_entity.updated_at = now
    total_entity.updated_at = now
    return hours * 2


async def record_energy_reading(
    db: AsyncSession,
    entity: Entity,
    numeric_state: float,
    *,
    previous_state: str | None = None,
    recorded_at: datetime | None = None,
) -> EnergyReading | None:
    recorded_at = recorded_at or datetime.now(UTC)

    if entity.device_class == "power":
        previous = (
            await db.execute(
                select(EnergyReading)
                .where(EnergyReading.entity_id == entity.entity_id)
                .order_by(EnergyReading.recorded_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        elapsed_hours = 0.0
        if previous is not None:
            elapsed_seconds = max((recorded_at - previous.recorded_at).total_seconds(), 0.0)
            elapsed_hours = elapsed_seconds / 3600
        reading = EnergyReading(
            entity_id=entity.entity_id,
            power_w=numeric_state,
            energy_kwh=round(numeric_state * elapsed_hours / 1000, 6),
            recorded_at=recorded_at,
        )
        db.add(reading)
        return reading

    if entity.device_class != "energy":
        return None

    previous_total = coerce_numeric_value(previous_state)
    delta_kwh = max(numeric_state - previous_total, 0.0) if previous_total is not None else 0.0
    sibling_power = None
    if entity.device_id is not None:
        sibling_power = (
            await db.execute(
                select(Entity)
                .where(Entity.device_id == entity.device_id, Entity.device_class == "power")
                .limit(1)
            )
        ).scalar_one_or_none()

    reading = EnergyReading(
        entity_id=entity.entity_id,
        power_w=coerce_numeric_value(sibling_power.state if sibling_power is not None else None) or 0.0,
        energy_kwh=round(delta_kwh, 6),
        recorded_at=recorded_at,
    )
    db.add(reading)
    return reading
