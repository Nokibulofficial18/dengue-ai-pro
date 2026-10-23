"""
Router for Improvement 02 — Smart Reinspection Scheduling.
Provides REST endpoints for policies, rainfall observations,
evaluation triggers, manager decision reviews, calendar scheduling,
and operational metrics.
"""

from datetime import datetime, date, timedelta, timezone
import json
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from models.scheduling_schemas import (
    EvaluationRequest,
    EvaluationResult,
    InspectionPolicyCreate,
    InspectionPolicyOut,
    InspectionPolicyUpdate,
    LocationSchedulingStatusOut,
    RainfallObservationCreate,
    RainfallObservationOut,
    RecommendationDecisionRequest,
    ReinspectionRecommendationOut,
    ScheduledInspectionCompleteRequest,
    ScheduledInspectionCreate,
    ScheduledInspectionOut,
    SchedulingCalendarItem,
    SchedulingStatsOut,
    SupportingRecord,
)
from services.reinspection_scheduler import ReinspectionScheduler, _now_iso, _today_str, _parse_date
from utils.auth import AuthorityUser, get_current_authority_user

router = APIRouter(prefix="/scheduling", tags=["Smart Reinspection Scheduling"])


# ============================================================================
# POLICIES ENDPOINTS
# ============================================================================
@router.get("/policies", response_model=List[InspectionPolicyOut])
async def list_policies(
    active_only: bool = Query(True),
    scope_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List inspection policies configured in the system."""
    conditions = []
    params: Dict[str, Any] = {}
    if active_only:
        conditions.append("is_active = 1")
    if scope_type:
        conditions.append("scope_type = :scope_type")
        params["scope_type"] = scope_type

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = text(f"""
        SELECT id, name, scope_type, scope_id, location_category,
               normal_interval_days, recurrence_followup_days,
               resolution_followup_days, rainfall_threshold_mm,
               max_interval_days, is_active, created_at, updated_at
        FROM inspection_policies
        {where}
        ORDER BY created_at ASC
    """)
    res = await db.execute(query, params)
    return [
        InspectionPolicyOut(**{**dict(r), "is_active": bool(r["is_active"])})
        for r in res.mappings().all()
    ]


@router.post("/policies", response_model=InspectionPolicyOut, status_code=status.HTTP_201_CREATED)
async def create_policy(
    payload: InspectionPolicyCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Create a new custom inspection policy."""
    policy_id = f"POL-{uuid.uuid4().hex[:8].upper()}"
    now_str = _now_iso()
    await db.execute(
        text("""
            INSERT INTO inspection_policies
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
        {
            "id": policy_id,
            "name": payload.name,
            "scope_type": payload.scope_type,
            "scope_id": payload.scope_id,
            "location_category": payload.location_category,
            "normal_interval_days": payload.normal_interval_days,
            "recurrence_followup_days": payload.recurrence_followup_days,
            "resolution_followup_days": payload.resolution_followup_days,
            "rainfall_threshold_mm": payload.rainfall_threshold_mm,
            "max_interval_days": payload.max_interval_days,
            "is_active": 1 if payload.is_active else 0,
            "now": now_str,
        }
    )
    await db.commit()
    res = await db.execute(text("SELECT * FROM inspection_policies WHERE id = :id"), {"id": policy_id})
    r = res.mappings().first()
    return InspectionPolicyOut(**{**dict(r), "is_active": bool(r["is_active"])})


@router.patch("/policies/{policy_id}", response_model=InspectionPolicyOut)
async def update_policy(
    policy_id: str,
    payload: InspectionPolicyUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Update intervals or active state of an existing policy."""
    res = await db.execute(text("SELECT * FROM inspection_policies WHERE id = :id"), {"id": policy_id})
    row = res.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Policy not found")

    updates = []
    params: Dict[str, Any] = {"id": policy_id, "now": _now_iso()}
    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "is_active":
            updates.append("is_active = :is_active")
            params["is_active"] = 1 if val else 0
        else:
            updates.append(f"{field} = :{field}")
            params[field] = val

    if updates:
        updates.append("updated_at = :now")
        await db.execute(
            text(f"UPDATE inspection_policies SET {', '.join(updates)} WHERE id = :id"),
            params
        )
        await db.commit()

    updated = await db.execute(text("SELECT * FROM inspection_policies WHERE id = :id"), {"id": policy_id})
    r = updated.mappings().first()
    return InspectionPolicyOut(**{**dict(r), "is_active": bool(r["is_active"])})


# ============================================================================
# RAINFALL OBSERVATIONS ENDPOINTS
# ============================================================================
@router.get("/rainfall", response_model=List[RainfallObservationOut])
async def list_rainfall_observations(
    ward_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List recorded rainfall observations."""
    conditions = []
    params: Dict[str, Any] = {"limit": limit}
    if ward_id:
        conditions.append("ward_id = :ward_id")
        params["ward_id"] = ward_id

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = text(f"""
        SELECT id, rainfall_mm, recorded_at, ward_id, area_description,
               data_source, status, notes, created_at
        FROM rainfall_observations
        {where}
        ORDER BY recorded_at DESC
        LIMIT :limit
    """)
    res = await db.execute(query, params)
    return [RainfallObservationOut(**dict(r)) for r in res.mappings().all()]


@router.post("/rainfall", response_model=RainfallObservationOut, status_code=status.HTTP_201_CREATED)
async def record_rainfall_observation(
    payload: RainfallObservationCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Record a verified rainfall observation from a trusted source (e.g., BMD, sensor).
    Automatically triggers smart evaluation for locations in the target area!
    """
    rain_id = f"RAIN-{uuid.uuid4().hex[:8].upper()}"
    now_str = _now_iso()
    await db.execute(
        text("""
            INSERT INTO rainfall_observations
            (id, rainfall_mm, recorded_at, ward_id, area_description,
             data_source, status, notes, created_at)
            VALUES
            (:id, :rainfall_mm, :recorded_at, :ward_id, :area_description,
             :data_source, :status, :notes, :now)
        """),
        {
            "id": rain_id,
            "rainfall_mm": payload.rainfall_mm,
            "recorded_at": payload.recorded_at,
            "ward_id": payload.ward_id,
            "area_description": payload.area_description,
            "data_source": payload.data_source,
            "status": payload.status,
            "notes": payload.notes,
            "now": now_str,
        }
    )
    await db.commit()

    # Automatic evaluation trigger for affected ward
    if payload.ward_id:
        await ReinspectionScheduler.evaluate_all_eligible_locations(db, ward_id=payload.ward_id)

    res = await db.execute(text("SELECT * FROM rainfall_observations WHERE id = :id"), {"id": rain_id})
    return RainfallObservationOut(**dict(res.mappings().first()))


# ============================================================================
# EVALUATION TRIGGER ENDPOINTS
# ============================================================================
@router.post("/evaluate", response_model=EvaluationResult)
async def trigger_evaluation(
    payload: EvaluationRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Execute smart evaluation across locations to compute follow-up dates.
    Idempotent: will not duplicate active proposed recommendations.
    """
    if payload.location_id:
        rec = await ReinspectionScheduler.evaluate_location(
            db, payload.location_id, force_reevaluate=payload.force_reevaluate
        )
        new_recs = [rec] if rec and rec.get("status") == "proposed" else []
        return EvaluationResult(
            evaluated_locations_count=1,
            recommendations_generated=len(new_recs),
            recommendations_superseded=0,
            recommendations_unchanged=1 if (not new_recs and rec) else 0,
            new_recommendations=[ReinspectionRecommendationOut(**r) for r in new_recs]
        )

    res = await ReinspectionScheduler.evaluate_all_eligible_locations(
        db, ward_id=payload.ward_id, property_id=payload.property_id, force_reevaluate=payload.force_reevaluate
    )
    return EvaluationResult(
        evaluated_locations_count=res["evaluated_locations_count"],
        recommendations_generated=res["recommendations_generated"],
        recommendations_superseded=0,
        recommendations_unchanged=res["evaluated_locations_count"] - res["recommendations_generated"],
        new_recommendations=[ReinspectionRecommendationOut(**r) for r in res["new_recommendations"]]
    )


# ============================================================================
# RECOMMENDATIONS & DECISIONS ENDPOINTS
# ============================================================================
@router.get("/recommendations", response_model=List[ReinspectionRecommendationOut])
async def list_recommendations(
    status_filter: Optional[str] = Query(None, description="'proposed', 'approved', 'modified', 'rejected', etc."),
    location_id: Optional[str] = Query(None),
    property_id: Optional[str] = Query(None),
    ward_id: Optional[str] = Query(None),
    trigger_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List explainable reinspection recommendations."""
    conditions = []
    params: Dict[str, Any] = {}
    if status_filter:
        conditions.append("r.status = :status_filter")
        params["status_filter"] = status_filter
    if location_id:
        conditions.append("r.location_id = :location_id")
        params["location_id"] = location_id
    if property_id:
        conditions.append("l.property_id = :property_id")
        params["property_id"] = property_id
    if ward_id:
        conditions.append("p.ward_id = :ward_id")
        params["ward_id"] = ward_id
    if trigger_type:
        conditions.append("r.trigger_type = :trigger_type")
        params["trigger_type"] = trigger_type

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = text(f"""
        SELECT r.id, r.location_id, r.trigger_type, r.rule_code, r.rule_version,
               r.recommended_date, r.explanation, r.supporting_records_json,
               r.policy_id, r.status, r.evidence_level, r.created_at, r.updated_at,
               l.location_code, l.name AS location_name, l.category,
               p.id AS property_id, p.name AS property_name, p.ward_id,
               pol.name AS policy_name,
               d.decision, d.approved_date, d.decided_by, d.decision_notes
        FROM reinspection_recommendations r
        JOIN permanent_hazard_locations l ON r.location_id = l.id
        JOIN properties p ON l.property_id = p.id
        LEFT JOIN inspection_policies pol ON r.policy_id = pol.id
        LEFT JOIN recommendation_decisions d ON d.recommendation_id = r.id
        {where}
        ORDER BY
            CASE r.status
                WHEN 'proposed' THEN 1
                WHEN 'approved' THEN 2
                WHEN 'modified' THEN 3
                ELSE 4
            END ASC,
            r.recommended_date ASC
    """)
    res = await db.execute(query, params)
    out = []
    for row in res.mappings().all():
        d = dict(row)
        try:
            d["supporting_records"] = json.loads(d.get("supporting_records_json") or "[]")
        except Exception:
            d["supporting_records"] = []
        out.append(ReinspectionRecommendationOut(**d))
    return out


@router.get("/recommendations/{recommendation_id}", response_model=ReinspectionRecommendationOut)
async def get_recommendation_detail(
    recommendation_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve complete recommendation explanation and supporting evidence."""
    rec = await ReinspectionScheduler.get_recommendation_by_id(db, recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return ReinspectionRecommendationOut(**rec)


@router.post("/recommendations/{recommendation_id}/decide", response_model=ReinspectionRecommendationOut)
async def decide_recommendation(
    recommendation_id: str,
    payload: RecommendationDecisionRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Manager action: Approve, Modify date, or Reject a recommended inspection.
    Audited with manager ID, decision notes, and timestamps.
    """
    try:
        updated = await ReinspectionScheduler.apply_manager_decision(
            db=db,
            recommendation_id=recommendation_id,
            decision=payload.decision,
            approved_date=payload.approved_date,
            decision_notes=payload.decision_notes,
            reviewer_name=user.username,
        )
        return ReinspectionRecommendationOut(**updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# SCHEDULED INSPECTIONS & VISITS ENDPOINTS
# ============================================================================
@router.get("/scheduled", response_model=List[ScheduledInspectionOut])
async def list_scheduled_inspections(
    status_filter: Optional[str] = Query(None, description="'approved', 'completed', 'cancelled'"),
    property_id: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List scheduled inspection visits."""
    conditions = []
    params: Dict[str, Any] = {}
    if status_filter:
        conditions.append("s.status = :status_filter")
        params["status_filter"] = status_filter
    if property_id:
        conditions.append("l.property_id = :property_id")
        params["property_id"] = property_id
    if location_id:
        conditions.append("s.location_id = :location_id")
        params["location_id"] = location_id
    if date_from:
        conditions.append("s.scheduled_date >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("s.scheduled_date <= :date_to")
        params["date_to"] = date_to

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = text(f"""
        SELECT s.id, s.location_id, s.recommendation_id, s.scheduled_date,
               s.visit_type, s.status, s.assigned_inspector, s.created_by,
               s.completed_inspection_id, s.completed_at, s.notes,
               s.created_at, s.updated_at,
               l.location_code, l.name AS location_name,
               p.id AS property_id, p.name AS property_name, p.ward_id
        FROM scheduled_inspections s
        JOIN permanent_hazard_locations l ON s.location_id = l.id
        JOIN properties p ON l.property_id = p.id
        {where}
        ORDER BY s.scheduled_date ASC
    """)
    res = await db.execute(query, params)
    today = date.today().isoformat()
    out = []
    for row in res.mappings().all():
        d = dict(row)
        d["is_overdue"] = bool(d["status"] == "approved" and d["scheduled_date"] < today)
        out.append(ScheduledInspectionOut(**d))
    return out


@router.post("/scheduled", response_model=ScheduledInspectionOut, status_code=status.HTTP_201_CREATED)
async def create_manual_scheduled_inspection(
    payload: ScheduledInspectionCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Manually schedule an inspection visit for a location."""
    sched_id = f"SCHED-{payload.location_id}-{payload.scheduled_date.replace('-', '')}-{uuid.uuid4().hex[:4].upper()}"
    now_str = _now_iso()
    await db.execute(
        text("""
            INSERT INTO scheduled_inspections
            (id, location_id, scheduled_date, visit_type, status,
             assigned_inspector, created_by, notes, created_at, updated_at)
            VALUES
            (:id, :location_id, :scheduled_date, :visit_type, 'approved',
             :assigned_inspector, :created_by, :notes, :now, :now)
        """),
        {
            "id": sched_id,
            "location_id": payload.location_id,
            "scheduled_date": payload.scheduled_date,
            "visit_type": payload.visit_type,
            "assigned_inspector": payload.assigned_inspector,
            "created_by": user.username,
            "notes": payload.notes,
            "now": now_str,
        }
    )
    await db.commit()

    query = text("""
        SELECT s.*, l.location_code, l.name AS location_name,
               p.id AS property_id, p.name AS property_name, p.ward_id
        FROM scheduled_inspections s
        JOIN permanent_hazard_locations l ON s.location_id = l.id
        JOIN properties p ON l.property_id = p.id
        WHERE s.id = :id
    """)
    res = await db.execute(query, {"id": sched_id})
    d = dict(res.mappings().first())
    d["is_overdue"] = False
    return ScheduledInspectionOut(**d)


@router.patch("/scheduled/{scheduled_id}/complete", response_model=ScheduledInspectionOut)
async def complete_scheduled_inspection_endpoint(
    scheduled_id: str,
    payload: ScheduledInspectionCompleteRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Link a real recorded inspection to mark a scheduled visit as completed."""
    res = await db.execute(text("SELECT id FROM scheduled_inspections WHERE id = :id"), {"id": scheduled_id})
    if not res.mappings().first():
        raise HTTPException(status_code=404, detail="Scheduled visit not found")

    updated = await ReinspectionScheduler.complete_scheduled_inspection(
        db, scheduled_id, payload.completed_inspection_id, payload.notes
    )

    query = text("""
        SELECT s.*, l.location_code, l.name AS location_name,
               p.id AS property_id, p.name AS property_name, p.ward_id
        FROM scheduled_inspections s
        JOIN permanent_hazard_locations l ON s.location_id = l.id
        JOIN properties p ON l.property_id = p.id
        WHERE s.id = :id
    """)
    res2 = await db.execute(query, {"id": scheduled_id})
    d = dict(res2.mappings().first())
    d["is_overdue"] = False
    return ScheduledInspectionOut(**d)


# ============================================================================
# CALENDAR ENDPOINTS
# ============================================================================
@router.get("/calendar", response_model=List[SchedulingCalendarItem])
async def get_scheduling_calendar(
    property_id: Optional[str] = Query(None),
    ward_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Retrieve unified inspection calendar entries:
    - Proposed Recommendations (Awaiting review)
    - Approved Scheduled Visits (Active calendar)
    - Overdue Visits (Action required)
    - Completed Visits
    """
    items: List[SchedulingCalendarItem] = []
    today = date.today().isoformat()

    # 1. Fetch Scheduled Visits
    sched_conds = []
    params: Dict[str, Any] = {}
    if property_id:
        sched_conds.append("l.property_id = :prop_id")
        params["prop_id"] = property_id
    if ward_id:
        sched_conds.append("p.ward_id = :ward_id")
        params["ward_id"] = ward_id
    if date_from:
        sched_conds.append("s.scheduled_date >= :date_from")
        params["date_from"] = date_from
    if date_to:
        sched_conds.append("s.scheduled_date <= :date_to")
        params["date_to"] = date_to

    where_sched = f"WHERE {' AND '.join(sched_conds)}" if sched_conds else ""
    query_sched = text(f"""
        SELECT s.id, s.scheduled_date, s.status, s.visit_type, s.assigned_inspector, s.notes,
               l.id AS location_id, l.location_code, l.name AS location_name, l.category,
               p.id AS property_id, p.name AS property_name, p.ward_id
        FROM scheduled_inspections s
        JOIN permanent_hazard_locations l ON s.location_id = l.id
        JOIN properties p ON l.property_id = p.id
        {where_sched}
        ORDER BY s.scheduled_date ASC
    """)
    res_sched = await db.execute(query_sched, params)
    for row in res_sched.mappings().all():
        s_date = row["scheduled_date"]
        s_status = row["status"]
        if s_status == "approved" and s_date < today:
            cal_status = "overdue"
            title = f"⚠️ OVERDUE: {row['location_code']}"
        elif s_status == "completed":
            cal_status = "completed"
            title = f"✓ Completed: {row['location_code']}"
        else:
            cal_status = "approved"
            title = f"📅 Approved Visit: {row['location_code']}"

        items.append(
            SchedulingCalendarItem(
                id=row["id"],
                item_type="approved_visit" if s_status != "completed" else "completed_visit",
                date=s_date,
                location_id=row["location_id"],
                location_code=row["location_code"],
                location_name=row["location_name"],
                property_id=row["property_id"],
                property_name=row["property_name"],
                ward_id=row["ward_id"],
                category=row["category"],
                status=cal_status,
                title=title,
                subtitle=f"{row['property_name']} ({row['category'].replace('_', ' ')})",
                explanation=row["notes"],
                assigned_inspector=row["assigned_inspector"],
            )
        )

    # 2. Fetch Proposed Recommendations (Pending review)
    rec_conds = ["r.status = 'proposed'"]
    if property_id:
        rec_conds.append("l.property_id = :prop_id")
    if ward_id:
        rec_conds.append("p.ward_id = :ward_id")
    if date_from:
        rec_conds.append("r.recommended_date >= :date_from")
    if date_to:
        rec_conds.append("r.recommended_date <= :date_to")

    where_rec = f"WHERE {' AND '.join(rec_conds)}"
    query_rec = text(f"""
        SELECT r.id, r.recommended_date, r.trigger_type, r.explanation,
               l.id AS location_id, l.location_code, l.name AS location_name, l.category,
               p.id AS property_id, p.name AS property_name, p.ward_id
        FROM reinspection_recommendations r
        JOIN permanent_hazard_locations l ON r.location_id = l.id
        JOIN properties p ON l.property_id = p.id
        {where_rec}
        ORDER BY r.recommended_date ASC
    """)
    res_rec = await db.execute(query_rec, params)
    for row in res_rec.mappings().all():
        items.append(
            SchedulingCalendarItem(
                id=row["id"],
                item_type="proposed_recommendation",
                date=row["recommended_date"],
                location_id=row["location_id"],
                location_code=row["location_code"],
                location_name=row["location_name"],
                property_id=row["property_id"],
                property_name=row["property_name"],
                ward_id=row["ward_id"],
                category=row["category"],
                status="proposed",
                title=f"💡 Proposed ({row['trigger_type'].replace('_', ' ').title()}): {row['location_code']}",
                subtitle=f"{row['property_name']} — Awaiting Manager Approval",
                explanation=row["explanation"],
            )
        )

    # Sort unified calendar by date ascending
    items.sort(key=lambda x: x.date)
    return items


# ============================================================================
# OPERATIONAL STATISTICS ENDPOINTS
# ============================================================================
@router.get("/stats", response_model=SchedulingStatsOut)
async def get_scheduling_statistics(
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve verified operational scheduling statistics based on stored records."""
    today = date.today().isoformat()

    loc_count = (await db.execute(text("SELECT count(*) FROM permanent_hazard_locations WHERE status = 'active'"))).scalar() or 0
    pol_count = (await db.execute(text("SELECT count(*) FROM inspection_policies WHERE is_active = 1"))).scalar() or 0

    recs_total = (await db.execute(text("SELECT count(*) FROM reinspection_recommendations"))).scalar() or 0
    recs_prop = (await db.execute(text("SELECT count(*) FROM reinspection_recommendations WHERE status = 'proposed'"))).scalar() or 0
    recs_app = (await db.execute(text("SELECT count(*) FROM reinspection_recommendations WHERE status IN ('approved', 'modified')"))).scalar() or 0
    recs_rej = (await db.execute(text("SELECT count(*) FROM reinspection_recommendations WHERE status = 'rejected'"))).scalar() or 0

    total_decided = recs_app + recs_rej
    acceptance_rate = round((recs_app / total_decided * 100.0), 1) if total_decided > 0 else 0.0

    sched_total = (await db.execute(text("SELECT count(*) FROM scheduled_inspections"))).scalar() or 0
    sched_upcoming = (await db.execute(text(
        "SELECT count(*) FROM scheduled_inspections WHERE status = 'approved' AND scheduled_date >= :today"
    ), {"today": today})).scalar() or 0
    sched_overdue = (await db.execute(text(
        "SELECT count(*) FROM scheduled_inspections WHERE status = 'approved' AND scheduled_date < :today"
    ), {"today": today})).scalar() or 0
    sched_completed = (await db.execute(text(
        "SELECT count(*) FROM scheduled_inspections WHERE status = 'completed'"
    ))).scalar() or 0

    # Count issues discovered on follow-ups (inspections linked to completed scheduled visits that found a problem)
    issues_on_reinsp = (await db.execute(text("""
        SELECT count(*)
        FROM scheduled_inspections s
        JOIN location_inspections i ON s.completed_inspection_id = i.id
        WHERE i.result = 'problem_found'
    """))).scalar() or 0

    # Recurring issues discovered
    repeat_issues = (await db.execute(text("""
        SELECT count(*)
        FROM location_issues
        WHERE is_recurrence = 1
    """))).scalar() or 0

    # Rainfall events
    rain_events = (await db.execute(text("SELECT count(*) FROM rainfall_observations"))).scalar() or 0

    return SchedulingStatsOut(
        total_locations=loc_count,
        active_policies=pol_count,
        total_recommendations=recs_total,
        proposed_recommendations=recs_prop,
        approved_recommendations=recs_app,
        rejected_recommendations=recs_rej,
        acceptance_rate_pct=acceptance_rate,
        total_scheduled_visits=sched_total,
        upcoming_approved_visits=sched_upcoming,
        overdue_visits=sched_overdue,
        completed_visits=sched_completed,
        issues_found_on_reinspection=issues_on_reinsp,
        recurring_issues_caught=repeat_issues,
        recent_rainfall_events=rain_events,
    )


# ============================================================================
# LOCATION SCHEDULING STATUS ENDPOINT (EMBEDDED IN LOCATION DETAIL)
# ============================================================================
@router.get("/location/{location_id}/status", response_model=LocationSchedulingStatusOut)
async def get_location_scheduling_status(
    location_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve current scheduling status for a specific hazard location."""
    loc_res = await db.execute(
        text("SELECT id, property_id, category FROM permanent_hazard_locations WHERE id = :id"),
        {"id": location_id}
    )
    loc = loc_res.mappings().first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    policy = await ReinspectionScheduler.get_effective_policy(db, loc["property_id"], loc["category"])

    # Last inspection
    insp_res = await db.execute(
        text("SELECT inspection_date, result FROM location_inspections WHERE location_id = :id ORDER BY inspection_date DESC LIMIT 1"),
        {"id": location_id}
    )
    last_insp = insp_res.mappings().first()
    last_date = last_insp["inspection_date"][:10] if last_insp else None
    last_res = last_insp["result"] if last_insp else None

    # Calculate next required date
    today = date.today()
    if last_date:
        next_req_date = (_parse_date(last_date) + timedelta(days=policy["normal_interval_days"])).isoformat()
    else:
        next_req_date = (today + timedelta(days=7)).isoformat()

    # Active recommendation
    active_rec_res = await db.execute(
        text("SELECT id FROM reinspection_recommendations WHERE location_id = :id AND status = 'proposed' ORDER BY created_at DESC LIMIT 1"),
        {"id": location_id}
    )
    active_rec_row = active_rec_res.mappings().first()
    active_rec = None
    if active_rec_row:
        active_rec_dict = await ReinspectionScheduler.get_recommendation_by_id(db, active_rec_row["id"])
        if active_rec_dict:
            active_rec = ReinspectionRecommendationOut(**active_rec_dict)

    # Next approved visit
    visit_res = await db.execute(
        text("""
            SELECT s.*, l.location_code, l.name AS location_name,
                   p.id AS property_id, p.name AS property_name, p.ward_id
            FROM scheduled_inspections s
            JOIN permanent_hazard_locations l ON s.location_id = l.id
            JOIN properties p ON l.property_id = p.id
            WHERE s.location_id = :id AND s.status = 'approved' AND s.scheduled_date >= :today
            ORDER BY s.scheduled_date ASC
            LIMIT 1
        """),
        {"id": location_id, "today": today.isoformat()}
    )
    v_row = visit_res.mappings().first()
    next_visit = None
    if v_row:
        v_dict = dict(v_row)
        v_dict["is_overdue"] = False
        next_visit = ScheduledInspectionOut(**v_dict)

    status_summary = "Compliant with routine inspection schedule"
    if active_rec:
        status_summary = f"⚠️ Reinspection proposed: {active_rec.trigger_type.replace('_', ' ').title()}"
    elif next_visit:
        status_summary = f"📅 Inspection scheduled for {next_visit.scheduled_date}"

    return LocationSchedulingStatusOut(
        location_id=location_id,
        effective_policy_name=policy["name"],
        normal_interval_days=policy["normal_interval_days"],
        last_inspection_date=last_date,
        last_inspection_result=last_res,
        next_required_date=next_req_date,
        has_active_recommendation=active_rec is not None,
        active_recommendation=active_rec,
        next_approved_visit=next_visit,
        status_summary=status_summary,
    )
