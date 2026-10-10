
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String

from app.database import Base


class TelemetryReading(Base):
    __tablename__ = "telemetry_readings"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(String, index=True, nullable=False)
    property_name = Column(String, nullable=False)
    site = Column(String, nullable=False)
    electricity_kwh = Column(Float, nullable=False)
    water_kl = Column(Float, nullable=False)
    anomaly = Column(Boolean, default=False, nullable=False)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    data_source = Column(String, default="SIMULATED", nullable=False)