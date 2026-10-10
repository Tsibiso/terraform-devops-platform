
import random
from datetime import datetime, timezone

PROPERTIES = [
    {"id": "PROP-001", "name": "Test Property", "site": "Pretoria"},
    {"id": "PROP-002", "name": "Auckland park Office", "site": "Johannesburg"},
    {"id": "PROP-003", "name": "Tembisa Business Park", "site": "Ekhuruleni"},
    {"id": "PROP-004", "name": "Micro", "site": "Midrand"},
    {"id": "PROP-005", "name": "Utility Demo Site", "site": "Cape Town"},
]


def generate_reading(property_info: dict) -> dict:
    """Generate one fictional electricity and water reading."""

    # Occasionally simulate unusually high usage.
    anomaly = random.random() < 0.08

    electricity_kwh = round(
        random.uniform(8, 35) * (2.5 if anomaly else 1), 2
    )
    water_kl = round(
        random.uniform(0.05, 0.40) * (3 if anomaly else 1), 3
    )

    return {
        "property_id": property_info["id"],
        "property_name": property_info["name"],
        "site": property_info["site"],
        "electricity_kwh": electricity_kwh,
        "water_kl": water_kl,
        "anomaly": anomaly,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data_source": "SIMULATED",
    }


def generate_all_readings() -> list[dict]:
    """Generate one reading for every demo property."""

    return [generate_reading(p) for p in PROPERTIES]