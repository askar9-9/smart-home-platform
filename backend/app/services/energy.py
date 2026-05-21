from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, EnergyReading, Entity
from app.services.common import get_default_home
from app.services.entities import get_entity_or_404


def period_start(period: str) -> datetime:
    now = datetime.now(UTC)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def coerce_numeric_state(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def energy_summary(db: AsyncSession, period: str = "day") -> dict[str, Any]:
    home = await get_default_home(db)
    start = period_start(period)
    end = datetime.now(UTC)
    total = (await db.execute(select(func.coalesce(func.sum(EnergyReading.energy_kwh), 0)).where(EnergyReading.recorded_at >= start))).scalar_one()
    current_power_entities = (await db.execute(select(Entity.state).where(Entity.device_class == "power"))).scalars().all()
    current_power = sum(value for item in current_power_entities if (value := coerce_numeric_state(item)) is not None)
    if current_power == 0:
        current_power = (
            await db.execute(select(func.coalesce(func.sum(EnergyReading.power_w), 0)).where(EnergyReading.recorded_at >= end - timedelta(hours=1)))
        ).scalar_one()
    peak = (await db.execute(select(func.coalesce(func.max(EnergyReading.power_w), 0)).where(EnergyReading.recorded_at >= start))).scalar_one()
    device_count = (await db.execute(select(func.count(Device.id)))).scalar_one()
    return {
        "period": period,
        "total_kwh": round(float(total), 3),
        "total_cost": round(float(total) * 18.0, 2),
        "currency": home.currency,
        "current_power_w": round(float(current_power), 2),
        "peak_power_w": round(float(peak), 2),
        "device_count": device_count,
        "date_from": start,
        "date_to": end,
    }


async def energy_consumption(db: AsyncSession, period: str = "day", granularity: str = "hour") -> dict[str, Any]:
    start = period_start(period)
    rows = (
        await db.execute(
            select(
                func.date_trunc(granularity, EnergyReading.recorded_at).label("bucket"),
                func.sum(EnergyReading.energy_kwh),
                func.avg(EnergyReading.power_w),
            )
            .where(EnergyReading.recorded_at >= start)
            .group_by("bucket")
            .order_by("bucket")
        )
    ).all()
    return {"period": period, "granularity": granularity, "data": [{"timestamp": row[0], "kwh": round(float(row[1] or 0), 3), "power_w": round(float(row[2] or 0), 2)} for row in rows]}


async def energy_devices(db: AsyncSession, period: str = "day") -> list[dict[str, Any]]:
    start = period_start(period)
    rows = (
        await db.execute(
            select(EnergyReading.entity_id, func.sum(EnergyReading.energy_kwh), func.avg(EnergyReading.power_w))
            .where(EnergyReading.recorded_at >= start)
            .group_by(EnergyReading.entity_id)
        )
    ).all()
    total = sum(float(row[1] or 0) for row in rows) or 1
    out = []
    for entity_id, kwh, avg_power in rows:
        entity = await get_entity_or_404(db, entity_id)
        current = float(entity.state or 0) if str(entity.state).replace(".", "", 1).isdigit() else float(avg_power or 0)
        seven_day_avg = (
            await db.execute(
                select(func.avg(EnergyReading.power_w)).where(EnergyReading.entity_id == entity_id, EnergyReading.recorded_at >= datetime.now(UTC) - timedelta(days=7))
            )
        ).scalar_one() or 0
        anomaly = current > float(seven_day_avg) * 1.4 if seven_day_avg else False
        item = {
            "entity_id": entity_id,
            "device_name": entity.name,
            "kwh": round(float(kwh or 0), 3),
            "current_power_w": round(current, 2),
            "percentage": round(float(kwh or 0) / total * 100, 2),
            "anomaly": anomaly,
        }
        if anomaly:
            item["anomaly_reason"] = "Потребление выше среднего за 7 дней более чем на 40%"
        out.append(item)
    return out


async def energy_forecast(db: AsyncSession) -> dict[str, Any]:
    rows = (await db.execute(select(EnergyReading.power_w, EnergyReading.energy_kwh).order_by(EnergyReading.recorded_at.desc()).limit(24))).all()
    values = list(reversed(rows)) or [(0, 0)]
    forecast = [{"hour": index, "predicted_kwh": round(float(row[1] or 0), 3), "predicted_power_w": round(float(row[0] or 0), 2)} for index, row in enumerate(values[:24])]
    return {"period_hours": 24, "forecast": forecast, "total_predicted_kwh": round(sum(item["predicted_kwh"] for item in forecast), 3), "confidence": "mock"}
