from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.dashboard import build_dashboard
from app.services.events import query_events
from app.services.integration_catalog import DISCOVERY_CATALOG, get_catalog, supported_integration_domain


class TestIntegrationCatalog:
    def test_supported_domains(self):
        assert supported_integration_domain("demo") is True
        assert supported_integration_domain("mqtt") is True
        assert supported_integration_domain("zigbee") is False
        assert supported_integration_domain("unknown") is False

    def test_get_catalog_demo(self):
        catalog = get_catalog("demo")
        assert isinstance(catalog, list)
        assert len(catalog) > 0
        assert all("discovered_id" in item for item in catalog)
        assert all("entities" in item for item in catalog)

    def test_get_catalog_mqtt(self):
        catalog = get_catalog("mqtt")
        assert isinstance(catalog, list)
        assert len(catalog) > 0
        for item in catalog:
            for entity in item["entities"]:
                assert "entity_id" in entity
                assert "domain" in entity

    def test_catalog_data_is_disjoint(self):
        demo_ids = {item["discovered_id"] for item in get_catalog("demo")}
        mqtt_ids = {item["discovered_id"] for item in get_catalog("mqtt")}
        assert demo_ids & mqtt_ids == set()

    def test_catalog_entity_ids_unique(self):
        all_entity_ids = set()
        for domain in ("demo", "mqtt"):
            for item in get_catalog(domain):
                for entity in item["entities"]:
                    eid = entity["entity_id"]
                    assert eid not in all_entity_ids, f"Duplicate entity_id: {eid}"
                    all_entity_ids.add(eid)


class TestEventsService:
    @pytest.mark.asyncio
    async def test_query_events_empty(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()

        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        rows_result = MagicMock()
        rows_result.scalars.return_value.all.return_value = []

        mock_db.execute.side_effect = [count_result, rows_result]

        result = await query_events(mock_db)
        assert result["total"] == 0
        assert result["events"] == []
        assert result["limit"] == 50
        assert result["offset"] == 0

    @pytest.mark.asyncio
    async def test_query_events_limit_clamping(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()

        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        rows_result = MagicMock()
        rows_result.scalars.return_value.all.return_value = []

        mock_db.execute.side_effect = [count_result, rows_result]

        result = await query_events(mock_db, limit=500)
        assert result["limit"] == 200

        mock_db.execute.side_effect = [count_result, rows_result]
        result = await query_events(mock_db, limit=-5)
        assert result["limit"] == 1

    @pytest.mark.asyncio
    async def test_query_events_with_filters(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock()

        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        rows_result = MagicMock()
        rows_result.scalars.return_value.all.return_value = []

        mock_db.execute.side_effect = [count_result, rows_result]

        from_ = datetime.now(UTC)
        await query_events(mock_db, entity_id="light.kitchen", from_=from_)
        assert mock_db.execute.call_count == 2


class TestDashboardService:
    @pytest.mark.asyncio
    async def test_build_dashboard_empty_state(self):
        mock_db = AsyncMock()

        home = MagicMock()
        home.id = uuid.uuid4()
        home.name = "Test Home"

        mock_db.execute = AsyncMock()
        mock_db.execute.side_effect = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
        ]

        with patch("app.services.dashboard.get_default_home", new=AsyncMock(return_value=home)):
            with patch("app.services.dashboard.energy_summary", new=AsyncMock(return_value={
                "total_kwh": 0, "current_power_w": 0, "total_cost": 0,
                "currency": "KZT", "peak_power_w": 0, "device_count": 0,
                "period": "day", "date_from": datetime.now(UTC), "date_to": datetime.now(UTC),
            })):
                with patch("app.services.dashboard.query_events", new=AsyncMock(return_value={"events": []})):
                    result = await build_dashboard(mock_db)

        assert result["home"]["name"] == "Test Home"
        assert result["areas"] == []
        assert result["summary"]["devices_total"] == 0
        assert result["recent_events"] == []

    @pytest.mark.asyncio
    async def test_build_dashboard_with_areas(self):
        mock_db = AsyncMock()

        home = MagicMock()
        home.id = uuid.uuid4()
        home.name = "Test Home"

        area = MagicMock()
        area.id = uuid.uuid4()
        area.name = "Kitchen"
        area.icon = "kitchen"
        area.temperature_entity_id = "sensor.kitchen_temp"
        area.humidity_entity_id = "sensor.kitchen_humidity"

        mock_db.execute = AsyncMock()
        mock_db.execute.side_effect = [
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[area])))),
            MagicMock(scalar_one=MagicMock(return_value=3)),
            MagicMock(scalar_one=MagicMock(return_value=2)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=MagicMock(state="22.5"))),
            MagicMock(scalar_one_or_none=MagicMock(return_value=MagicMock(state="45"))),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
            MagicMock(scalar_one=MagicMock(return_value=0)),
        ]

        with patch("app.services.dashboard.get_default_home", new=AsyncMock(return_value=home)):
            with patch("app.services.dashboard.energy_summary", new=AsyncMock(return_value={
                "total_kwh": 5.2, "current_power_w": 350, "total_cost": 93.6,
                "currency": "KZT", "peak_power_w": 800, "device_count": 5,
                "period": "day", "date_from": datetime.now(UTC), "date_to": datetime.now(UTC),
            })):
                with patch("app.services.dashboard.query_events", new=AsyncMock(return_value={"events": []})):
                    result = await build_dashboard(mock_db)

        assert len(result["areas"]) == 1
        assert result["areas"][0]["name"] == "Kitchen"
        assert result["areas"][0]["temperature"] == "22.5"
        assert result["areas"][0]["humidity"] == "45"
        assert result["areas"][0]["devices_online"] == 2
        assert result["areas"][0]["devices_total"] == 3
        assert result["summary"]["energy_today_kwh"] == 5.2
