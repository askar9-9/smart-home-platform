from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.models import EnergyReading, Entity
from app.services.energy import power_readings_stmt
from app.services.energy_ingest import coerce_numeric_value, demo_power_profile, seed_demo_energy_history


class TestCoerceNumericValue:
    def test_valid_float_string(self):
        assert coerce_numeric_value("22.5") == 22.5

    def test_valid_int_string(self):
        assert coerce_numeric_value("100") == 100.0

    def test_valid_number(self):
        assert coerce_numeric_value(42) == 42.0
        assert coerce_numeric_value(3.14) == 3.14

    def test_none_returns_none(self):
        assert coerce_numeric_value(None) is None

    def test_empty_string_returns_none(self):
        assert coerce_numeric_value("") is None

    def test_non_numeric_string_returns_none(self):
        assert coerce_numeric_value("on") is None
        assert coerce_numeric_value("off") is None
        assert coerce_numeric_value("hello") is None

    def test_boolean_returns_numeric(self):
        assert coerce_numeric_value(True) == 1.0
        assert coerce_numeric_value(False) == 0.0


class TestDemoPowerProfile:
    def test_profile_is_deterministic_and_contains_spikes(self):
        baseline = demo_power_profile(datetime(2026, 5, 25, 10, tzinfo=UTC))
        anomaly = demo_power_profile(datetime(2026, 5, 27, 19, tzinfo=UTC))

        assert baseline == demo_power_profile(datetime(2026, 5, 25, 10, tzinfo=UTC))
        assert anomaly > 1500
        assert baseline < anomaly


class TestPowerReadingsStmt:
    def test_returns_select_with_join(self):
        stmt = power_readings_stmt(EnergyReading.id)
        assert stmt._setup_joins is not None
        assert len(stmt._setup_joins) > 0

    def test_has_where_criteria(self):
        stmt = power_readings_stmt(EnergyReading.id)
        assert len(stmt._where_criteria) == 1
        clause = str(stmt._where_criteria[0])
        assert "device_class" in clause

    def test_device_class_parameterized(self):
        stmt_default = power_readings_stmt(EnergyReading.id)
        stmt_energy = power_readings_stmt(EnergyReading.id, device_class="energy")
        assert stmt_default._where_criteria != stmt_energy._where_criteria


@pytest.mark.asyncio
async def test_seed_demo_energy_history_is_idempotent(db_session):
    power_entity = Entity(
        entity_id="sensor.test_power",
        domain="sensor",
        name="Power",
        state="0",
        attributes_json={},
        device_class="power",
    )
    total_entity = Entity(
        entity_id="sensor.test_total",
        domain="sensor",
        name="Total",
        state="0",
        attributes_json={},
        device_class="energy",
    )
    db_session.add_all([power_entity, total_entity])
    await db_session.flush()

    created = await seed_demo_energy_history(db_session, power_entity, total_entity, hours=24)
    await db_session.flush()
    repeated = await seed_demo_energy_history(db_session, power_entity, total_entity, hours=24)

    assert created == 48
    assert repeated == 0
