"""
Seed data for Improvement 02 — Smart Reinspection Scheduling.
Initializes inspection policies, realistic rainfall observations from
Bangladesh Meteorological Department (BMD), and pre-evaluates initial
hazard locations.
"""

from datetime import datetime, date, timedelta, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


POLICIES_SEED = [
    {
        "id": "POL-GLOBAL-DEFAULT",
        "name": "Dhaka Municipal Standard Inspection Policy",
        "scope_type": "global",
        "scope_id": None,
        "location_category": "all",
        "normal_interval_days": 14,
        "recurrence_followup_days": 5,
        "resolution_followup_days": 7,
        "rainfall_threshold_mm": 25.0,
        "max_interval_days": 30,
        "is_active": 1,
    },
    {
        "id": "POL-ROOF-DRAIN",
        "name": "High-Risk Roof Drains & Rain-Exposed Overhead Points",
        "scope_type": "global",
        "scope_id": None,
        "location_category": "roof_drain",
        "normal_interval_days": 10,
        "recurrence_followup_days": 3,
        "resolution_followup_days": 5,
        "rainfall_threshold_mm": 20.0,
        "max_interval_days": 21,
        "is_active": 1,
    },
    {
        "id": "POL-CONSTRUCTION",
        "name": "Active Construction Pits & Ground Excavations",
        "scope_type": "global",
        "scope_id": None,
        "location_category": "construction_pit",
        "normal_interval_days": 7,
        "recurrence_followup_days": 3,
        "resolution_followup_days": 4,
        "rainfall_threshold_mm": 15.0,
        "max_interval_days": 14,
        "is_active": 1,
    },
    {
        "id": "POL-SUMP-BASEMENT",
        "name": "Basement Sumps & Enclosed Drainage Sinks",
        "scope_type": "global",
        "scope_id": None,
        "location_category": "basement_sump",
        "normal_interval_days": 14,
        "recurrence_followup_days": 5,
        "resolution_followup_days": 7,
        "rainfall_threshold_mm": 35.0,
        "max_interval_days": 30,
        "is_active": 1,
    },
]

RAINFALL_SEED = [
    {
        "id": "RAIN-2026-001",
        "rainfall_mm": 38.5,
        "recorded_at": _days_ago(1),
        "ward_id": "W-01",
        "area_description": "Mirpur-10 & Section 6 Industrial Sector",
        "data_source": "Bangladesh Meteorological Department (BMD Agargaon Station)",
        "status": "verified",
        "notes": "Intense pre-monsoon convective shower with surface ponding recorded across Northern Dhaka.",
    },
    {
        "id": "RAIN-2026-002",
        "rainfall_mm": 28.0,
        "recorded_at": _days_ago(2),
        "ward_id": "W-04",
        "area_description": "Tejgaon Industrial Area & Hatirjheel Catchment",
        "data_source": "DNCC Automated Weather Telemetry Unit",
        "status": "verified",
        "notes": "Moderate rainfall event, localized drainage overflow.",
    },
]


async def seed_scheduling_if_empty(db: AsyncSession):
    """Seed policies and rainfall observations if none exist, then run initial evaluation."""
    # Check policies
    p_count = (await db.execute(text("SELECT count(*) FROM inspection_policies"))).scalar()
    now_str = _now_iso()

    if p_count == 0:
        for p in POLICIES_SEED:
            await db.execute(
                text("""
                    INSERT OR IGNORE INTO inspection_policies
                    (id, name, scope_type, scope_id, location_category,
                     normal_interval_days, recurrence_followup_days,
                     resolution_followup_days, rainfall_threshold_mm,
                     max_interval_days, is_active, created_at, updated_at)
                    VALUES
                    (:id, :name, :scope_type, :scope_id, :location_category,
                     :normal_interval_days, :recurrence_followup_days,
                     :resolution_followup_days, :rainfall_threshold_mm,
                     :max_interval_days, :is_active, :now, :now)
                """),
                {**p, "now": now_str}
            )
        await db.commit()

    # Check rainfall
    r_count = (await db.execute(text("SELECT count(*) FROM rainfall_observations"))).scalar()
    if r_count == 0:
        for r in RAINFALL_SEED:
            await db.execute(
                text("""
                    INSERT OR IGNORE INTO rainfall_observations
                    (id, rainfall_mm, recorded_at, ward_id, area_description,
                     data_source, status, notes, created_at)
                    VALUES
                    (:id, :rainfall_mm, :recorded_at, :ward_id, :area_description,
                     :data_source, :status, :notes, :now)
                """),
                {**r, "now": now_str}
            )
        await db.commit()

    # Run initial evaluation for existing locations if recommendations are empty
    rec_count = (await db.execute(text("SELECT count(*) FROM reinspection_recommendations"))).scalar()
    if rec_count == 0:
        from services.reinspection_scheduler import ReinspectionScheduler
        await ReinspectionScheduler.evaluate_all_eligible_locations(db)
