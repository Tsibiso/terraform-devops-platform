
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import TelemetryReading
from app.services.simulator import generate_all_readings


# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

TEMPLATES_DIR = PROJECT_ROOT / "app" / "templates"
STATIC_DIR = PROJECT_ROOT / "app" / "static"


# --------------------------------------------------
# APPLICATION LIFECYCLE
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables when the application starts.
    Base.metadata.create_all(bind=engine)
    yield


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="IoT Cloud Operations Platform",
    description=(
        "A simulated IoT utility monitoring platform "
        "built with FastAPI, SQLite and Terraform."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# --------------------------------------------------
# STATIC FILES
# --------------------------------------------------

app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)


# --------------------------------------------------
# DASHBOARD
# --------------------------------------------------

@app.get("/dashboard", include_in_schema=False)
def dashboard():
    return FileResponse(TEMPLATES_DIR / "index.html")


# --------------------------------------------------
# ROOT ENDPOINT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "project": "IoT Cloud Operations Platform",
        "status": "running",
        "version": "1.0.0",
        "data_mode": "SIMULATED",
        "dashboard": "/dashboard",
        "api_documentation": "/docs",
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# --------------------------------------------------
# PLATFORM INFORMATION
# --------------------------------------------------

@app.get("/api/info")
def info():
    return {
        "application": "IoT Cloud Operations Platform",
        "environment": "development",
        "data_mode": "SIMULATED",
        "technologies": [
            "Python",
            "FastAPI",
            "SQLite",
            "Terraform",
            "AWS",
            "GitHub Actions",
        ],
    }


# --------------------------------------------------
# PROPERTY SUMMARIES
# --------------------------------------------------

@app.get("/api/properties")
def properties(db: Session = Depends(get_db)):
    rows = (
        db.query(
            TelemetryReading.property_id,
            TelemetryReading.property_name,
            TelemetryReading.site,
            func.count(TelemetryReading.id).label("reading_count"),
            func.sum(
                TelemetryReading.electricity_kwh
            ).label("total_electricity_kwh"),
            func.sum(
                TelemetryReading.water_kl
            ).label("total_water_kl"),
            func.max(
                TelemetryReading.timestamp
            ).label("latest_reading"),
        )
        .group_by(
            TelemetryReading.property_id,
            TelemetryReading.property_name,
            TelemetryReading.site,
        )
        .order_by(TelemetryReading.property_name)
        .all()
    )

    return [
        {
            "property_id": row.property_id,
            "property_name": row.property_name,
            "site": row.site,
            "reading_count": row.reading_count,
            "total_electricity_kwh": round(
                row.total_electricity_kwh or 0, 2
            ),
            "total_water_kl": round(
                row.total_water_kl or 0, 3
            ),
            "latest_reading": (
                row.latest_reading.isoformat()
                if row.latest_reading
                else None
            ),
        }
        for row in rows
    ]


# --------------------------------------------------
# GENERATE AND SAVE SIMULATED TELEMETRY
# --------------------------------------------------

@app.post("/api/telemetry/generate")
def generate_telemetry(db: Session = Depends(get_db)):
    generated = generate_all_readings()
    saved = []

    try:
        for reading in generated:
            reading_data = reading.copy()

            # Convert ISO timestamp string into a datetime object
            timestamp = reading_data.get("timestamp")

            if isinstance(timestamp, str):
                reading_data["timestamp"] = datetime.fromisoformat(
                    timestamp.replace("Z", "+00:00")
                )

            # Create SQLAlchemy model with correct data types
            record = TelemetryReading(**reading_data)

            db.add(record)
            saved.append(record)

        # Save all generated readings
        db.commit()

        # Refresh records to retrieve generated IDs
        for record in saved:
            db.refresh(record)

    except Exception:
        db.rollback()
        raise

    return {
        "message": "Simulated telemetry generated and saved",
        "data_source": "SIMULATED",
        "count": len(saved),
        "readings": [
            {
                "id": record.id,
                "property_id": record.property_id,
                "property_name": record.property_name,
                "site": record.site,
                "electricity_kwh": record.electricity_kwh,
                "water_kl": record.water_kl,
                "anomaly": record.anomaly,
                "timestamp": record.timestamp.isoformat(),
                "data_source": record.data_source,
            }
            for record in saved
        ],
    }

# --------------------------------------------------
# LATEST TELEMETRY READINGS
# --------------------------------------------------

@app.get("/api/telemetry/latest")
def latest_telemetry(
    limit: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    readings = (
        db.query(TelemetryReading)
        .order_by(
            TelemetryReading.timestamp.desc(),
            TelemetryReading.id.desc(),
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "id": reading.id,
            "property_id": reading.property_id,
            "property_name": reading.property_name,
            "site": reading.site,
            "electricity_kwh": reading.electricity_kwh,
            "water_kl": reading.water_kl,
            "anomaly": reading.anomaly,
            "timestamp": reading.timestamp.isoformat(),
            "data_source": reading.data_source,
        }
        for reading in readings
    ]


# --------------------------------------------------
# SIMULATED CONSUMPTION ALERTS
# --------------------------------------------------

@app.get("/api/alerts")
def alerts(
    limit: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    records = (
        db.query(TelemetryReading)
        .filter(TelemetryReading.anomaly.is_(True))
        .order_by(
            TelemetryReading.timestamp.desc(),
            TelemetryReading.id.desc(),
        )
        .limit(limit)
        .all()
    )

    return [
        {
            "id": record.id,
            "property_id": record.property_id,
            "property_name": record.property_name,
            "site": record.site,
            "electricity_kwh": record.electricity_kwh,
            "water_kl": record.water_kl,
            "timestamp": record.timestamp.isoformat(),
            "severity": "HIGH",
            "message": "Unusually high simulated utility consumption",
            "data_source": "SIMULATED",
        }
        for record in records
    ]

