from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EnergyReading, Entity
from app.services.energy import period_start
from smart_home_ml import (
    DATASET_NAME,
    EnergyFeatureRow,
    build_feature_frame,
    build_feature_vector,
    load_model_artifact,
    reason_for,
    severity_for_score,
)
from smart_home_ml.model import ModelArtifact


def _load_ml_model() -> ModelArtifact:
    try:
        return load_model_artifact()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _fallback_anomaly_indexes(rows: list[EnergyFeatureRow], timeline: list[dict[str, Any]]) -> set[int]:
    """Surface obvious outliers when the ML window is too small to emit anomalies."""
    candidates: list[tuple[int, float]] = []
    for index, row in enumerate(rows):
        hour = row.recorded_at.hour
        obvious_peak = row.power_w >= 1500
        night_spike = hour < 6 and row.power_w >= 700
        if obvious_peak or night_spike:
            candidates.append((index, float(timeline[index]["anomaly_score"])))

    if not candidates:
        return set()

    candidates.sort(key=lambda item: item[1], reverse=True)
    return {candidates[0][0]}


async def load_energy_feature_rows(db: AsyncSession, period: str, limit: int) -> list[EnergyFeatureRow]:
    start = period_start(period)
    rows = (
        await db.execute(
            select(EnergyReading, Entity.name)
            .join(Entity, Entity.entity_id == EnergyReading.entity_id, isouter=True)
            .where(Entity.device_class == "power")
            .where(EnergyReading.recorded_at >= start)
            .order_by(EnergyReading.recorded_at.desc())
            .limit(limit)
        )
    ).all()

    feature_rows: list[EnergyFeatureRow] = []
    for reading, entity_name in reversed(rows):
        feature_rows.append(
            EnergyFeatureRow(
                id=str(reading.id),
                entity_id=reading.entity_id,
                device_name=entity_name or reading.entity_id,
                recorded_at=reading.recorded_at,
                power_w=float(reading.power_w or 0),
                energy_kwh=float(reading.energy_kwh or 0),
                features=build_feature_vector(reading.power_w, reading.energy_kwh, reading.recorded_at),
            )
        )
    return feature_rows


async def detect_energy_anomalies(db: AsyncSession, period: str, limit: int) -> dict[str, Any]:
    artifact = _load_ml_model()
    rows = await load_energy_feature_rows(db, period, limit)
    metadata = artifact.metadata
    model_name = metadata.get("model_name", "IsolationForest")
    trained_at = metadata.get("trained_at") or datetime.now(UTC).isoformat()
    dataset = metadata.get("dataset", DATASET_NAME)

    if not rows:
        return {
            "model": {"name": model_name, "dataset": dataset, "trained_at": trained_at, "confidence": "ml"},
            "summary": {"total": 0, "anomalies": 0, "period": period},
            "anomalies": [],
            "timeline": [],
        }

    feature_matrix = build_feature_frame(rows)
    raw_scores = artifact.model.decision_function(feature_matrix)
    predictions = artifact.model.predict(feature_matrix)

    timeline = []
    anomalies = []
    for row, raw_score, prediction in zip(rows, raw_scores, predictions, strict=True):
        anomaly_score = round(float(-raw_score), 4)
        is_anomaly = int(prediction) == -1
        timeline.append(
            {
                "timestamp": row.recorded_at.isoformat(),
                "power_w": round(row.power_w, 2),
                "energy_kwh": round(row.energy_kwh, 3),
                "anomaly_score": anomaly_score,
                "anomaly": is_anomaly,
            }
        )
        if is_anomaly:
            anomalies.append(
                {
                    "id": row.id,
                    "entity_id": row.entity_id,
                    "device_name": row.device_name,
                    "recorded_at": row.recorded_at.isoformat(),
                    "power_w": round(row.power_w, 2),
                    "energy_kwh": round(row.energy_kwh, 3),
                    "anomaly_score": anomaly_score,
                    "severity": severity_for_score(anomaly_score),
                    "reason": reason_for(row.device_name, row.power_w, row.recorded_at.hour, anomaly_score),
                }
            )

    if not anomalies:
        for index in _fallback_anomaly_indexes(rows, timeline):
            row = rows[index]
            timeline[index]["anomaly"] = True
            anomalies.append(
                {
                    "id": row.id,
                    "entity_id": row.entity_id,
                    "device_name": row.device_name,
                    "recorded_at": row.recorded_at.isoformat(),
                    "power_w": round(row.power_w, 2),
                    "energy_kwh": round(row.energy_kwh, 3),
                    "anomaly_score": float(timeline[index]["anomaly_score"]),
                    "severity": severity_for_score(float(timeline[index]["anomaly_score"])),
                    "reason": reason_for(row.device_name, row.power_w, row.recorded_at.hour, float(timeline[index]["anomaly_score"])),
                }
            )

    return {
        "model": {"name": model_name, "dataset": dataset, "trained_at": trained_at, "confidence": "ml"},
        "summary": {"total": len(rows), "anomalies": len(anomalies), "period": period},
        "anomalies": anomalies,
        "timeline": timeline,
    }
