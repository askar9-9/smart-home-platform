from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app import runtime
from app.config import settings


class _FailingConnection:
    def __init__(self, message: str) -> None:
        self.message = message

    async def __aenter__(self) -> "_FailingConnection":
        raise SQLAlchemyError(self.message)

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


class _FailingEngine:
    def __init__(self, message: str) -> None:
        self.message = message

    def connect(self) -> _FailingConnection:
        return _FailingConnection(self.message)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("db_error", "expected_reason"),
    [
        ("Connect call failed", "database connection was refused"),
        ('role "smart_home" does not exist', 'database role "smart_home" does not exist'),
    ],
)
async def test_ensure_database_ready_fails_with_local_dev_guidance(
    monkeypatch: pytest.MonkeyPatch,
    db_error: str,
    expected_reason: str,
) -> None:
    monkeypatch.setattr(runtime, "engine", _FailingEngine(db_error))

    with pytest.raises(RuntimeError) as exc_info:
        await runtime.ensure_database_ready()

    message = str(exc_info.value)
    assert expected_reason in message
    assert "docker compose up -d postgres mosquitto" in message
    assert "backend/.env.local.example" in message


@pytest.mark.asyncio
async def test_prepare_runtime_skips_migrations_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(settings, "run_migrations_on_start", False)
    monkeypatch.setattr(settings, "seed_enabled", True)

    async def ensure_database_ready() -> None:
        calls.append("db")

    async def run_migrations() -> None:
        calls.append("migrations")

    async def seed_database() -> None:
        calls.append("seed")

    await runtime.prepare_runtime(
        ensure_database_ready_fn=ensure_database_ready,
        run_migrations_fn=run_migrations,
        seed_database_fn=seed_database,
    )

    assert calls == ["db", "seed"]


@pytest.mark.asyncio
async def test_prepare_runtime_runs_migrations_before_seed(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(settings, "run_migrations_on_start", True)
    monkeypatch.setattr(settings, "seed_enabled", True)

    async def ensure_database_ready() -> None:
        calls.append("db")

    async def run_migrations() -> None:
        calls.append("migrations")

    async def seed_database() -> None:
        calls.append("seed")

    await runtime.prepare_runtime(
        ensure_database_ready_fn=ensure_database_ready,
        run_migrations_fn=run_migrations,
        seed_database_fn=seed_database,
    )

    assert calls == ["db", "migrations", "seed"]


@pytest.mark.asyncio
async def test_simulate_demo_mqtt_cycle_uses_mqtt_handler_path(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str]] = []

    async def fake_handle_mqtt_state_message(_db, topic: str, payload: str) -> None:
        calls.append((topic, payload))

    monkeypatch.setattr("app.services.mqtt_handler.handle_mqtt_state_message", fake_handle_mqtt_state_message)

    total_energy_kwh, motion_state = await runtime.simulate_demo_mqtt_cycle(
        SimpleNamespace(),
        total_energy_kwh=12.5,
        motion_state="off",
        recorded_at=datetime(2026, 5, 28, 20, 0, 0, tzinfo=UTC),
    )

    assert total_energy_kwh > 12.5
    assert motion_state in {"on", "off"}
    assert any(topic == "home/hallway/meter/power/state" for topic, _ in calls)
    assert any(topic == "home/hallway/meter/total/state" for topic, _ in calls)
    assert any(topic == "home/hallway/motion/state" for topic, _ in calls)
