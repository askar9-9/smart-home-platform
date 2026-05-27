from app.services.actions import call_action
from app.services.automations import condition_matches, evaluate_automations, run_automation
from app.services.common import delete_by_id, get_default_home
from app.services.devices import create_default_entity_for_device, slugify
from app.services.energy import energy_consumption, energy_devices, energy_forecast, energy_summary, period_start
from app.services.energy_ingest import coerce_numeric_value, record_energy_reading
from app.services.entities import get_entity_or_404, set_entity_state
from app.services.integration_catalog import DISCOVERY_CATALOG, get_catalog, supported_integration_domain
from app.services.integrations import discovery_preview, get_integration_or_404, import_discovered_devices
from app.services.ml import detect_energy_anomalies

__all__ = [
    "DISCOVERY_CATALOG",
    "call_action",
    "coerce_numeric_value",
    "condition_matches",
    "create_default_entity_for_device",
    "delete_by_id",
    "discovery_preview",
    "detect_energy_anomalies",
    "energy_consumption",
    "energy_devices",
    "energy_forecast",
    "energy_summary",
    "evaluate_automations",
    "get_default_home",
    "get_entity_or_404",
    "get_integration_or_404",
    "import_discovered_devices",
    "period_start",
    "record_energy_reading",
    "run_automation",
    "set_entity_state",
    "slugify",
    "supported_integration_domain",
]
