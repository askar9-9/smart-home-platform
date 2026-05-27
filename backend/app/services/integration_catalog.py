from __future__ import annotations

from typing import Any

DISCOVERY_CATALOG: dict[str, list[dict[str, Any]]] = {
    "demo": [
        {
            "discovered_id": "demo.porch_light",
            "name": "Porch Light",
            "type": "light",
            "manufacturer": "Demo",
            "model": "DL-100",
            "entities": [
                {
                    "entity_id": "light.porch_light",
                    "domain": "light",
                    "name": "Porch Light",
                    "state": "off",
                    "attributes": {"brightness": 0},
                }
            ],
        },
        {
            "discovered_id": "demo.garage_outlet",
            "name": "Garage Outlet",
            "type": "switch",
            "manufacturer": "Demo",
            "model": "DS-10",
            "entities": [
                {
                    "entity_id": "switch.garage_outlet",
                    "domain": "switch",
                    "name": "Garage Outlet",
                    "state": "off",
                    "attributes": {},
                }
            ],
        },
        {
            "discovered_id": "demo.office_climate",
            "name": "Office Climate",
            "type": "climate",
            "manufacturer": "Demo",
            "model": "DC-22",
            "entities": [
                {
                    "entity_id": "climate.office",
                    "domain": "climate",
                    "name": "Office Climate",
                    "state": "off",
                    "attributes": {"current_temperature": 22, "target_temperature": 22, "hvac_mode": "off"},
                    "device_class": "temperature",
                }
            ],
        },
        {
            "discovered_id": "demo.balcony_sensor",
            "name": "Balcony Sensor",
            "type": "sensor",
            "manufacturer": "Demo",
            "model": "DT-2",
            "entities": [
                {
                    "entity_id": "sensor.balcony_temperature",
                    "domain": "sensor",
                    "name": "Balcony Temperature",
                    "state": "21.5",
                    "attributes": {"friendly_name": "Balcony Temperature"},
                    "unit_of_measurement": "°C",
                    "device_class": "temperature",
                },
                {
                    "entity_id": "sensor.balcony_humidity",
                    "domain": "sensor",
                    "name": "Balcony Humidity",
                    "state": "41",
                    "attributes": {},
                    "unit_of_measurement": "%",
                    "device_class": "humidity",
                },
            ],
        },
        {
            "discovered_id": "demo.solar_meter",
            "name": "Solar Meter",
            "type": "energy_meter",
            "manufacturer": "Demo",
            "model": "DE-3",
            "entities": [
                {
                    "entity_id": "sensor.solar_meter_power",
                    "domain": "sensor",
                    "name": "Solar Meter Power",
                    "state": "0",
                    "attributes": {"energy_meter": True},
                    "unit_of_measurement": "W",
                    "device_class": "power",
                },
                {
                    "entity_id": "sensor.solar_meter_total",
                    "domain": "sensor",
                    "name": "Solar Meter Total",
                    "state": "0",
                    "attributes": {"state_class": "total_increasing"},
                    "unit_of_measurement": "kWh",
                    "device_class": "energy",
                },
            ],
        },
    ],
    "mqtt": [
        {
            "discovered_id": "mqtt.living_room_strip",
            "name": "MQTT Living Room Strip",
            "type": "light",
            "manufacturer": "MQTT",
            "model": "RGB-Strip",
            "entities": [
                {
                    "entity_id": "light.mqtt_living_room_strip",
                    "domain": "light",
                    "name": "MQTT Living Room Strip",
                    "state": "off",
                    "attributes": {
                        "brightness": 0,
                        "state_topic": "home/living_room/strip/state",
                        "command_topic": "home/living_room/strip/set",
                        "brightness_state_topic": "home/living_room/strip/brightness/state",
                        "brightness_command_topic": "home/living_room/strip/brightness/set",
                    },
                }
            ],
        },
        {
            "discovered_id": "mqtt.garage_relay",
            "name": "MQTT Garage Relay",
            "type": "switch",
            "manufacturer": "MQTT",
            "model": "Relay-1",
            "entities": [
                {
                    "entity_id": "switch.mqtt_garage_relay",
                    "domain": "switch",
                    "name": "MQTT Garage Relay",
                    "state": "off",
                    "attributes": {
                        "state_topic": "home/garage/relay/state",
                        "command_topic": "home/garage/relay/set",
                    },
                }
            ],
        },
        {
            "discovered_id": "mqtt.office_sensor",
            "name": "MQTT Office Sensor",
            "type": "sensor",
            "manufacturer": "MQTT",
            "model": "TH-1",
            "entities": [
                {
                    "entity_id": "sensor.mqtt_office_temperature",
                    "domain": "sensor",
                    "name": "MQTT Office Temperature",
                    "state": "22.4",
                    "attributes": {
                        "state_topic": "home/office/sensor/temperature/state",
                    },
                    "unit_of_measurement": "°C",
                    "device_class": "temperature",
                },
                {
                    "entity_id": "sensor.mqtt_office_humidity",
                    "domain": "sensor",
                    "name": "MQTT Office Humidity",
                    "state": "43",
                    "attributes": {
                        "state_topic": "home/office/sensor/humidity/state",
                    },
                    "unit_of_measurement": "%",
                    "device_class": "humidity",
                },
            ],
        },
        {
            "discovered_id": "mqtt.hallway_motion",
            "name": "MQTT Hallway Motion",
            "type": "sensor",
            "manufacturer": "MQTT",
            "model": "Motion-1",
            "entities": [
                {
                    "entity_id": "binary_sensor.mqtt_hallway_motion",
                    "domain": "binary_sensor",
                    "name": "MQTT Hallway Motion",
                    "state": "off",
                    "attributes": {
                        "device_class": "motion",
                        "state_topic": "home/hallway/motion/state",
                    },
                    "device_class": "motion",
                }
            ],
        },
        {
            "discovered_id": "mqtt.hallway_lux",
            "name": "MQTT Hallway Lux",
            "type": "sensor",
            "manufacturer": "MQTT",
            "model": "Lux-1",
            "entities": [
                {
                    "entity_id": "sensor.mqtt_hallway_lux",
                    "domain": "sensor",
                    "name": "MQTT Hallway Lux",
                    "state": "15",
                    "attributes": {
                        "state_topic": "home/hallway/lux/state",
                    },
                    "unit_of_measurement": "lx",
                    "device_class": "illuminance",
                }
            ],
        },
        {
            "discovered_id": "mqtt.main_energy_meter",
            "name": "MQTT Main Energy Meter",
            "type": "energy_meter",
            "manufacturer": "MQTT",
            "model": "Power-1",
            "entities": [
                {
                    "entity_id": "sensor.mqtt_main_energy_power",
                    "domain": "sensor",
                    "name": "MQTT Main Energy Power",
                    "state": "0",
                    "attributes": {
                        "energy_meter": True,
                        "state_topic": "home/hallway/meter/power/state",
                    },
                    "unit_of_measurement": "W",
                    "device_class": "power",
                },
                {
                    "entity_id": "sensor.mqtt_main_energy_total",
                    "domain": "sensor",
                    "name": "MQTT Main Energy Total",
                    "state": "0",
                    "attributes": {
                        "state_class": "total_increasing",
                        "state_topic": "home/hallway/meter/total/state",
                    },
                    "unit_of_measurement": "kWh",
                    "device_class": "energy",
                },
            ],
        },
    ],
}


def supported_integration_domain(domain: str) -> bool:
    return domain in DISCOVERY_CATALOG


def get_catalog(domain: str) -> list[dict[str, Any]]:
    return DISCOVERY_CATALOG[domain]
