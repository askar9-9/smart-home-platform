from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

ARTIFACT_PATH = Path(__file__).resolve().parent / "artifacts" / "energy_isolation_forest.joblib"
DATASET_NAME = "UCI Individual Household Electric Power Consumption"
DATASET_DOI = "10.24432/C58K54"


@dataclass(frozen=True)
class ModelArtifact:
    model: Any
    metadata: dict[str, Any]


def load_model_artifact(path: Path = ARTIFACT_PATH) -> ModelArtifact:
    if not path.exists():
        raise FileNotFoundError("model_not_ready")

    try:
        import joblib
    except ImportError as exc:
        raise RuntimeError("model_runtime_not_ready") from exc

    payload = joblib.load(path)
    if not isinstance(payload, dict) or "model" not in payload:
        raise ValueError("model_artifact_invalid")

    metadata = dict(payload.get("metadata") or {})
    return ModelArtifact(model=payload["model"], metadata=metadata)


def severity_for_score(score: float) -> str:
    if score >= 0.12:
        return "high"
    if score >= 0.06:
        return "medium"
    return "low"


def reason_for(device_name: str, power_w: float, hour: int, score: float) -> str:
    _ = device_name
    if power_w >= 1500:
        return "Высокая мгновенная мощность относительно ML-профиля"
    if hour < 6 and power_w >= 700:
        return "Нетипичное ночное потребление по ML-профилю"
    if score >= 0.12:
        return "Сильное отклонение от обученного профиля потребления"
    return "Отклонение от обученного профиля потребления"
