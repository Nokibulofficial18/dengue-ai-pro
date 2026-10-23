from datetime import datetime, timedelta, timezone
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from demo_data import WARDS
from models.site_schemas import (
    ActivityCreate,
    ActivityOut,
    CitizenReportLinkRequest,
    CitizenReportWithLocation,
    ConfirmRecurrenceRequest,
    InspectionCreate,
    InspectionOut,
    IssueCreate,
    IssueOut,
    IssueResolveRequest,
    IssueUpdate,
    LocationCreate,
    LocationOut,
    LocationTimelineOut,
    LocationUpdate,
    PropertyCreate,
    PropertyOut,
    PropertyUpdate,
    RecurringLocationOut,
    TimelineEvent,
)
from utils.auth import (
    AuthorityUser,
    LoginRequest,
    LoginResponse,
    create_session,
    get_current_authority_user,
    verify_authority_credentials,
)

router = APIRouter(prefix="/sites", tags=["Site & Hazard Registry"])
auth_router = APIRouter(prefix="/authority", tags=["Authority Security"])


# ============================================================================
# AUTHORITY AUTHENTICATION (MINIMUM VIABLE DEV ACCESS)
# ============================================================================
@auth_router.post("/login", response_model=LoginResponse)
async def authority_login(payload: LoginRequest):
    """
    Authenticate authority personnel for the local development session.
    Returns a session token that the client holds in memory.
    """
    user = verify_authority_credentials(payload.username, payload.password, payload.role)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authority credentials. Check development username/password.",
        )
    token = create_session(user)
    return LoginResponse(token=token, user=user)


@auth_router.get("/me", response_model=AuthorityUser)
async def authority_me(user: AuthorityUser = Depends(get_current_authority_user)):
    """Return currently active authority profile."""
    return user


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_ward_name(ward_id: str) -> Optional[str]:
    w = next((w for w in WARDS if w["ward_id"] == ward_id), None)
    return w["ward_name"] if w else None


# ============================================================================
# FEATURE A — PROPERTY REGISTRATION & MANAGEMENT
# ============================================================================
@router.post("/properties", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
async def create_property(
    payload: PropertyCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Register a new property (factory, building, campus, hospital, etc.)."""
    ward_exists = (
        await db.execute(
            text("SELECT 1 FROM wards WHERE ward_id = :ward_id"),
            {"ward_id": payload.ward_id},
        )
    ).scalar()
    if not ward_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ward ID '{payload.ward_id}' is invalid or does not exist in registry.",
        )

    prop_id = f"PROP-{uuid.uuid4().hex[:8].upper()}"
    now = _now_iso()

    insert_sql = text(
        """
        INSERT INTO properties
        (id, name, property_type, ward_id, address, latitude, longitude,
         responsible_org, manager_name, manager_contact, status, created_at, updated_at)
        VALUES
        (:id, :name, :property_type, :ward_id, :address, :latitude, :longitude,
         :responsible_org, :manager_name, :manager_contact, 'active', :created_at, :updated_at)
        """
    )
    await db.execute(
        insert_sql,
        {
            "id": prop_id,
            "name": payload.name.strip(),
            "property_type": payload.property_type,
            "ward_id": payload.ward_id,
            "address": payload.address.strip(),
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "responsible_org": payload.responsible_org,
            "manager_name": payload.manager_name,
            "manager_contact": payload.manager_contact,
            "created_at": now,
            "updated_at": now,
        },
    )
    await db.commit()

    return PropertyOut(
        id=prop_id,
        name=payload.name.strip(),
        property_type=payload.property_type,
        ward_id=payload.ward_id,
        ward_name=_get_ward_name(payload.ward_id),
        address=payload.address.strip(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        responsible_org=payload.responsible_org,
        manager_name=payload.manager_name,
        manager_contact=payload.manager_contact,
        status="active",
        created_at=now,
        updated_at=now,
        location_count=0,
        active_issues_count=0,
    )


@router.get("/properties", response_model=List[PropertyOut])
async def list_properties(
    ward_id: Optional[str] = None,
    status_filter: Optional[str] = Query("all", alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List registered properties with aggregated location and active issue counts."""
    query_parts = [
        """
        SELECT p.*,
               COUNT(DISTINCT l.id) AS location_count,
               COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) AS active_issues_count
        FROM properties p
        LEFT JOIN permanent_hazard_locations l ON p.id = l.property_id
        LEFT JOIN location_issues i ON l.id = i.location_id
        WHERE 1=1
        """
    ]
    params = {}

    if ward_id:
        query_parts.append("AND p.ward_id = :ward_id")
        params["ward_id"] = ward_id

    if status_filter and status_filter != "all":
        query_parts.append("AND p.status = :status")
        params["status"] = status_filter

    if search:
        query_parts.append(
            "AND (p.name LIKE :search OR p.address LIKE :search OR p.responsible_org LIKE :search OR p.manager_name LIKE :search)"
        )
        params["search"] = f"%{search.strip()}%"

    query_parts.append("GROUP BY p.id ORDER BY p.updated_at DESC")
    full_sql = " ".join(query_parts)

    rows = (await db.execute(text(full_sql), params)).mappings().all()

    results = []
    for row in rows:
        r = dict(row)
        r["ward_name"] = _get_ward_name(r["ward_id"])
        r["location_count"] = int(r.get("location_count") or 0)
        r["active_issues_count"] = int(r.get("active_issues_count") or 0)
        results.append(PropertyOut(**r))
    return results


@router.get("/properties/{property_id}", response_model=PropertyOut)
async def get_property(
    property_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve details for a single registered property."""
    query_sql = text(
        """
        SELECT p.*,
               COUNT(DISTINCT l.id) AS location_count,
               COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) AS active_issues_count
        FROM properties p
        LEFT JOIN permanent_hazard_locations l ON p.id = l.property_id
        LEFT JOIN location_issues i ON l.id = i.location_id
        WHERE p.id = :property_id
        GROUP BY p.id
        """
    )
    row = (await db.execute(query_sql, {"property_id": property_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Property not found")

    r = dict(row)
    r["ward_name"] = _get_ward_name(r["ward_id"])
    r["location_count"] = int(r.get("location_count") or 0)
    r["active_issues_count"] = int(r.get("active_issues_count") or 0)
    return PropertyOut(**r)


@router.put("/properties/{property_id}", response_model=PropertyOut)
async def update_property(
    property_id: str,
    payload: PropertyUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Update details of an existing property."""
    existing = (
        await db.execute(
            text("SELECT * FROM properties WHERE id = :id"),
            {"id": property_id},
        )
    ).mappings().first()
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")

    if payload.ward_id:
        ward_exists = (
            await db.execute(
                text("SELECT 1 FROM wards WHERE ward_id = :ward_id"),
                {"ward_id": payload.ward_id},
            )
        ).scalar()
        if not ward_exists:
            raise HTTPException(status_code=400, detail="Specified Ward ID does not exist")

    now = _now_iso()
    updates = []
    params = {"id": property_id, "updated_at": now}

    for field, val in payload.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = :{field}")
        params[field] = val.strip() if isinstance(val, str) else val

    updates.append("updated_at = :updated_at")
    sql = f"UPDATE properties SET {', '.join(updates)} WHERE id = :id"
    await db.execute(text(sql), params)
    await db.commit()

    return await get_property(property_id, db, user)


@router.patch("/properties/{property_id}/archive", response_model=PropertyOut)
async def archive_property(
    property_id: str,
    archive: bool = Query(True, description="True to archive, False to restore active status"),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Archive or reactivate a property record."""
    status_val = "archived" if archive else "active"
    result = await db.execute(
        text("UPDATE properties SET status = :status, updated_at = :now WHERE id = :id"),
        {"status": status_val, "now": _now_iso(), "id": property_id},
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    await db.commit()
    return await get_property(property_id, db, user)


# ============================================================================
# FEATURE B & G — PERMANENT HAZARD LOCATION REGISTRATION & RECURRING LIST
# Note: /locations/recurring is declared BEFORE /locations/{location_id}
# ============================================================================
@router.get("/locations/recurring", response_model=List[RecurringLocationOut])
async def list_recurring_locations(
    days: int = Query(90, ge=1, le=365, description="Lookback window in days"),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Identifies locations with confirmed recurring problems.
    A recurring problem requires:
      1. An earlier issue was marked resolved.
      2. A similar issue was observed afterward.
      3. An authorized reviewer confirmed the recurrence link.
    Strictly calculated from stored database records without fabrications.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    sql = text(
        """
        SELECT l.*,
               p.name AS property_name,
               p.ward_id AS ward_id,
               COUNT(DISTINCT CASE WHEN i.is_recurrence = 1 AND i.observed_at >= :cutoff THEN i.id END) AS repeat_count_90d,
               COUNT(DISTINCT CASE WHEN i.is_recurrence = 1 THEN i.id END) AS total_repeat_count,
               COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) AS open_issues_count
        FROM permanent_hazard_locations l
        JOIN properties p ON l.property_id = p.id
        JOIN location_issues i ON l.id = i.location_id
        WHERE i.is_recurrence = 1
        GROUP BY l.id
        HAVING repeat_count_90d > 0 OR total_repeat_count > 0
        ORDER BY repeat_count_90d DESC, total_repeat_count DESC
        """
    )
    rows = (await db.execute(sql, {"cutoff": cutoff})).mappings().all()

    results: List[RecurringLocationOut] = []
    for row in rows:
        loc_id = row["id"]
        rec_issues_rows = (
            await db.execute(
                text(
                    """
                    SELECT i.*,
                           l.location_code,
                           l.name AS location_name,
                           p.name AS property_name,
                           prev.description AS previous_issue_description
                    FROM location_issues i
                    JOIN permanent_hazard_locations l ON i.location_id = l.id
                    JOIN properties p ON l.property_id = p.id
                    LEFT JOIN location_issues prev ON i.previous_issue_id = prev.id
                    WHERE i.location_id = :loc_id AND i.is_recurrence = 1
                    ORDER BY i.observed_at DESC
                    """
                ),
                {"loc_id": loc_id},
            )
        ).mappings().all()

        rec_issues = [IssueOut(**dict(r)) for r in rec_issues_rows]
        count_window = int(row.get("repeat_count_90d") or 0)
        total_rec = int(row.get("total_repeat_count") or 0)
        latest_iss = rec_issues[0] if rec_issues else None

        if count_window > 0:
            statement = f"This location has had {count_window} confirmed recurring problem{'s' if count_window > 1 else ''} in the last {days} days."
        else:
            statement = f"This location has had {total_rec} lifetime confirmed recurring issue{'s' if total_rec > 1 else ''}."

        results.append(
            RecurringLocationOut(
                location_id=loc_id,
                location_code=row["location_code"],
                location_name=row["name"],
                category=row["category"],
                property_id=row["property_id"],
                property_name=row["property_name"],
                ward_id=row["ward_id"],
                ward_name=_get_ward_name(row["ward_id"]) or row["ward_id"],
                repeat_count_90d=count_window,
                total_repeat_count=total_rec,
                open_issues_count=int(row.get("open_issues_count") or 0),
                latest_issue_date=latest_iss.observed_at if latest_iss else None,
                latest_issue_description=latest_iss.description if latest_iss else None,
                summary_statement=statement,
                recurring_issues=rec_issues,
            )
        )

    return results


@router.post(
    "/properties/{property_id}/locations",
    response_model=LocationOut,
    status_code=status.HTTP_201_CREATED,
)
async def register_hazard_location(
    property_id: str,
    payload: LocationCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Register a permanent hazard location within a property."""
    prop = (
        await db.execute(
            text("SELECT id, name, ward_id, latitude, longitude FROM properties WHERE id = :id"),
            {"id": property_id},
        )
    ).mappings().first()
    if not prop:
        raise HTTPException(status_code=404, detail="Parent property not found")

    code = payload.location_code.strip().upper()

    existing_code = (
        await db.execute(
            text(
                "SELECT 1 FROM permanent_hazard_locations WHERE property_id = :prop_id AND UPPER(location_code) = :code"
            ),
            {"prop_id": property_id, "code": code},
        )
    ).scalar()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Location code '{code}' already exists in this property. Must be unique within property scope.",
        )

    loc_id = f"LOC-{uuid.uuid4().hex[:8].upper()}"
    now = _now_iso()

    insert_sql = text(
        """
        INSERT INTO permanent_hazard_locations
        (id, property_id, location_code, name, category, floor_zone, written_directions,
         latitude, longitude, description, status, created_at, updated_at)
        VALUES
        (:id, :property_id, :location_code, :name, :category, :floor_zone, :written_directions,
         :latitude, :longitude, :description, 'active', :created_at, :updated_at)
        """
    )
    await db.execute(
        insert_sql,
        {
            "id": loc_id,
            "property_id": property_id,
            "location_code": code,
            "name": payload.name.strip(),
            "category": payload.category,
            "floor_zone": payload.floor_zone,
            "written_directions": payload.written_directions,
            "latitude": payload.latitude if payload.latitude is not None else prop["latitude"],
            "longitude": payload.longitude if payload.longitude is not None else prop["longitude"],
            "description": payload.description,
            "created_at": now,
            "updated_at": now,
        },
    )

    await db.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            (:id, :loc_id, 'registration', :by, :now, :notes, :now)
            """
        ),
        {
            "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "loc_id": loc_id,
            "by": user.display_name,
            "now": now,
            "notes": f"Permanent hazard location registered: {payload.name.strip()} ({code}).",
        },
    )
    await db.commit()

    return LocationOut(
        id=loc_id,
        property_id=property_id,
        property_name=prop["name"],
        ward_id=prop["ward_id"],
        ward_name=_get_ward_name(prop["ward_id"]),
        location_code=code,
        name=payload.name.strip(),
        category=payload.category,
        floor_zone=payload.floor_zone,
        written_directions=payload.written_directions,
        latitude=payload.latitude if payload.latitude is not None else prop["latitude"],
        longitude=payload.longitude if payload.longitude is not None else prop["longitude"],
        description=payload.description,
        status="active",
        created_at=now,
        updated_at=now,
        open_issues_count=0,
        total_inspections_count=0,
        confirmed_recurrences_count=0,
    )


@router.get("/locations", response_model=List[LocationOut])
async def list_hazard_locations(
    property_id: Optional[str] = None,
    ward_id: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = Query("all", alias="status"),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List permanent hazard locations with status filters and aggregated hazard counts."""
    query_parts = [
        """
        SELECT l.*,
               p.name AS property_name,
               p.ward_id AS ward_id,
               COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) AS open_issues_count,
               COUNT(DISTINCT insp.id) AS total_inspections_count,
               COUNT(DISTINCT CASE WHEN i.is_recurrence = 1 THEN i.id END) AS confirmed_recurrences_count
        FROM permanent_hazard_locations l
        JOIN properties p ON l.property_id = p.id
        LEFT JOIN location_issues i ON l.id = i.location_id
        LEFT JOIN location_inspections insp ON l.id = insp.location_id
        WHERE 1=1
        """
    ]
    params = {}

    if property_id:
        query_parts.append("AND l.property_id = :property_id")
        params["property_id"] = property_id

    if ward_id:
        query_parts.append("AND p.ward_id = :ward_id")
        params["ward_id"] = ward_id

    if category:
        query_parts.append("AND l.category = :category")
        params["category"] = category

    if status_filter and status_filter != "all":
        query_parts.append("AND l.status = :status")
        params["status"] = status_filter

    if search:
        query_parts.append(
            "AND (l.location_code LIKE :search OR l.name LIKE :search OR l.floor_zone LIKE :search OR p.name LIKE :search)"
        )
        params["search"] = f"%{search.strip()}%"

    query_parts.append("GROUP BY l.id ORDER BY l.updated_at DESC")
    rows = (await db.execute(text(" ".join(query_parts)), params)).mappings().all()

    results = []
    for row in rows:
        r = dict(row)
        r["ward_name"] = _get_ward_name(r.get("ward_id"))
        r["open_issues_count"] = int(r.get("open_issues_count") or 0)
        r["total_inspections_count"] = int(r.get("total_inspections_count") or 0)
        r["confirmed_recurrences_count"] = int(r.get("confirmed_recurrences_count") or 0)
        results.append(LocationOut(**r))
    return results


@router.get("/locations/{location_id}", response_model=LocationOut)
async def get_hazard_location(
    location_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve full location profile."""
    sql = text(
        """
        SELECT l.*,
               p.name AS property_name,
               p.ward_id AS ward_id,
               COUNT(DISTINCT CASE WHEN i.status = 'open' THEN i.id END) AS open_issues_count,
               COUNT(DISTINCT insp.id) AS total_inspections_count,
               COUNT(DISTINCT CASE WHEN i.is_recurrence = 1 THEN i.id END) AS confirmed_recurrences_count
        FROM permanent_hazard_locations l
        JOIN properties p ON l.property_id = p.id
        LEFT JOIN location_issues i ON l.id = i.location_id
        LEFT JOIN location_inspections insp ON l.id = insp.location_id
        WHERE l.id = :location_id
        GROUP BY l.id
        """
    )
    row = (await db.execute(sql, {"location_id": location_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Hazard location not found")

    r = dict(row)
    r["ward_name"] = _get_ward_name(r.get("ward_id"))
    r["open_issues_count"] = int(r.get("open_issues_count") or 0)
    r["total_inspections_count"] = int(r.get("total_inspections_count") or 0)
    r["confirmed_recurrences_count"] = int(r.get("confirmed_recurrences_count") or 0)
    return LocationOut(**r)


@router.put("/locations/{location_id}", response_model=LocationOut)
async def update_hazard_location(
    location_id: str,
    payload: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Update hazard location details."""
    loc = (
        await db.execute(
            text("SELECT * FROM permanent_hazard_locations WHERE id = :id"),
            {"id": location_id},
        )
    ).mappings().first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    now = _now_iso()
    updates = []
    params = {"id": location_id, "updated_at": now}

    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "location_code" and val:
            val = val.strip().upper()
            collision = (
                await db.execute(
                    text(
                        "SELECT 1 FROM permanent_hazard_locations WHERE property_id = :prop_id AND location_code = :c AND id != :id"
                    ),
                    {"prop_id": loc["property_id"], "c": val, "id": location_id},
                )
            ).scalar()
            if collision:
                raise HTTPException(status_code=400, detail="Location code is already in use at this property")
        updates.append(f"{field} = :{field}")
        params[field] = val.strip() if isinstance(val, str) else val

    updates.append("updated_at = :updated_at")
    sql = f"UPDATE permanent_hazard_locations SET {', '.join(updates)} WHERE id = :id"
    await db.execute(text(sql), params)
    await db.commit()

    return await get_hazard_location(location_id, db, user)


# ============================================================================
# FEATURE C — INSPECTION RECORDING & HISTORY
# ============================================================================
@router.post(
    "/locations/{location_id}/inspections",
    response_model=InspectionOut,
    status_code=status.HTTP_201_CREATED,
)
async def record_inspection(
    location_id: str,
    payload: InspectionCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Record an on-site physical inspection.
    Important rule: Clear inspection results are strictly documented as 'No hazard observed
    during this specific visit' and NOT proof of permanent safety.
    """
    loc = (
        await db.execute(
            text("SELECT id, name, location_code FROM permanent_hazard_locations WHERE id = :id"),
            {"id": location_id},
        )
    ).mappings().first()
    if not loc:
        raise HTTPException(status_code=404, detail="Hazard location not found")

    insp_id = f"INSP-{uuid.uuid4().hex[:8].upper()}"
    now = _now_iso()
    insp_date = payload.inspection_date or now

    await db.execute(
        text(
            """
            INSERT INTO location_inspections
            (id, location_id, inspector_name, inspector_role, inspection_date,
             result, notes, evidence_notes, problem_identified, weather_conditions, created_at)
            VALUES
            (:id, :location_id, :inspector_name, :inspector_role, :inspection_date,
             :result, :notes, :evidence_notes, :problem_identified, :weather_conditions, :created_at)
            """
        ),
        {
            "id": insp_id,
            "location_id": location_id,
            "inspector_name": payload.inspector_name.strip(),
            "inspector_role": payload.inspector_role or "Authority Inspector",
            "inspection_date": insp_date,
            "result": payload.result,
            "notes": payload.notes,
            "evidence_notes": payload.evidence_notes,
            "problem_identified": payload.problem_identified,
            "weather_conditions": payload.weather_conditions,
            "created_at": now,
        },
    )

    result_labels = {
        "clear": "Clear (No hazard observed at this visit)",
        "problem_found": "Problem Found",
        "unable_to_inspect": "Unable to Inspect",
    }
    await db.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            (:id, :loc_id, 'inspection', :by, :at, :notes, :now)
            """
        ),
        {
            "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "loc_id": location_id,
            "by": payload.inspector_name.strip(),
            "at": insp_date,
            "notes": f"Inspection recorded: result was {result_labels.get(payload.result, payload.result)}. {payload.notes or ''}".strip(),
            "now": now,
        },
    )

    if payload.result == "problem_found" and payload.create_issue:
        issue_id = f"ISSUE-{uuid.uuid4().hex[:8].upper()}"
        issue_desc = payload.issue_description or payload.problem_identified or "Hazard identified during inspection."
        issue_type = payload.issue_type or "standing_water"
        is_rec = 1 if payload.is_recurrence and payload.previous_issue_id else 0

        await db.execute(
            text(
                """
                INSERT INTO location_issues
                (id, location_id, inspection_id, issue_type, description, severity,
                 observed_at, status, is_recurrence, previous_issue_id,
                 recurrence_confirmed_by, recurrence_confirmed_at, created_at, updated_at)
                VALUES
                (:id, :location_id, :inspection_id, :issue_type, :description, :severity,
                 :observed_at, 'open', :is_rec, :prev_id, :rec_by, :rec_at, :now, :now)
                """
            ),
            {
                "id": issue_id,
                "location_id": location_id,
                "inspection_id": insp_id,
                "issue_type": issue_type,
                "description": issue_desc,
                "severity": payload.issue_severity or "medium",
                "observed_at": insp_date,
                "is_rec": is_rec,
                "prev_id": payload.previous_issue_id if is_rec else None,
                "rec_by": payload.inspector_name if is_rec else None,
                "rec_at": now if is_rec else None,
                "now": now,
            },
        )

    # If an approved scheduled inspection visit exists for this location, link and mark it completed
    active_sched = (
        await db.execute(
            text(
                """
                SELECT id FROM scheduled_inspections
                WHERE location_id = :loc_id AND status = 'approved'
                ORDER BY scheduled_date ASC LIMIT 1
                """
            ),
            {"loc_id": location_id},
        )
    ).mappings().first()
    if active_sched:
        await db.execute(
            text(
                """
                UPDATE scheduled_inspections
                SET status = 'completed',
                    completed_inspection_id = :insp_id,
                    completed_at = :now,
                    updated_at = :now
                WHERE id = :id
                """
            ),
            {"id": active_sched["id"], "insp_id": insp_id, "now": now},
        )

    await db.execute(
        text("UPDATE permanent_hazard_locations SET updated_at = :now WHERE id = :id"),
        {"now": now, "id": location_id},
    )
    await db.commit()

    # Trigger automatic smart reinspection re-evaluation
    try:
        from services.reinspection_scheduler import ReinspectionScheduler
        await ReinspectionScheduler.evaluate_location(db, location_id)
    except Exception as eval_err:
        print(f"Post-inspection scheduling evaluation notice: {eval_err}")

    return InspectionOut(
        id=insp_id,
        location_id=location_id,
        inspector_name=payload.inspector_name.strip(),
        inspector_role=payload.inspector_role,
        inspection_date=insp_date,
        result=payload.result,
        notes=payload.notes,
        evidence_notes=payload.evidence_notes,
        problem_identified=payload.problem_identified,
        weather_conditions=payload.weather_conditions,
        created_at=now,
    )


@router.get("/locations/{location_id}/inspections", response_model=List[InspectionOut])
async def list_location_inspections(
    location_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve all historical inspection records for a permanent hazard location."""
    rows = (
        await db.execute(
            text(
                "SELECT * FROM location_inspections WHERE location_id = :loc_id ORDER BY inspection_date DESC, created_at DESC"
            ),
            {"loc_id": location_id},
        )
    ).mappings().all()

    return [InspectionOut(**dict(row)) for row in rows]


# ============================================================================
# FEATURE D — ISSUES & FINDINGS
# ============================================================================
@router.post(
    "/locations/{location_id}/issues",
    response_model=IssueOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_location_issue(
    location_id: str,
    payload: IssueCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Log an issue or physical finding separately from the physical location."""
    loc = (
        await db.execute(
            text("SELECT id, name, location_code FROM permanent_hazard_locations WHERE id = :id"),
            {"id": location_id},
        )
    ).mappings().first()
    if not loc:
        raise HTTPException(status_code=404, detail="Hazard location not found")

    is_rec = 1 if payload.is_recurrence and payload.previous_issue_id else 0
    prev_id = payload.previous_issue_id if is_rec else None

    if prev_id:
        prev_row = (
            await db.execute(
                text("SELECT id, status, location_id FROM location_issues WHERE id = :id"),
                {"id": prev_id},
            )
        ).mappings().first()
        if not prev_row:
            raise HTTPException(status_code=400, detail="Referenced previous issue does not exist")
        if prev_row["location_id"] != location_id:
            raise HTTPException(
                status_code=400,
                detail="A recurring issue can only link to an earlier issue at the SAME location.",
            )
        if prev_row["status"] != "resolved":
            raise HTTPException(
                status_code=400,
                detail="Recurrence can only be confirmed against an EARLIER RESOLVED issue (an unresolved issue is an existing open problem, not a new recurrence).",
            )

    issue_id = f"ISSUE-{uuid.uuid4().hex[:8].upper()}"
    now = _now_iso()
    observed_at = payload.observed_at or now

    insert_sql = text(
        """
        INSERT INTO location_issues
        (id, location_id, inspection_id, issue_type, description, severity,
         observed_at, status, is_recurrence, previous_issue_id,
         recurrence_confirmed_by, recurrence_confirmed_at, created_at, updated_at)
        VALUES
        (:id, :location_id, :inspection_id, :issue_type, :description, :severity,
         :observed_at, 'open', :is_rec, :prev_id, :rec_by, :rec_at, :now, :now)
        """
    )
    await db.execute(
        insert_sql,
        {
            "id": issue_id,
            "location_id": location_id,
            "inspection_id": payload.inspection_id,
            "issue_type": payload.issue_type,
            "description": payload.description.strip(),
            "severity": payload.severity,
            "observed_at": observed_at,
            "is_rec": is_rec,
            "prev_id": prev_id,
            "rec_by": payload.recurrence_confirmed_by or (user.display_name if is_rec else None),
            "rec_at": now if is_rec else None,
            "now": now,
        },
    )

    act_note = f"Issue opened: {payload.issue_type} ({payload.severity} severity). {payload.description}"
    if is_rec:
        act_note += f" [CONFIRMED RECURRENCE of previous issue {prev_id}]"

    await db.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            (:id, :loc_id, :issue_id, 'issue_opened', :by, :at, :notes, :now)
            """
        ),
        {
            "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "loc_id": location_id,
            "issue_id": issue_id,
            "by": user.display_name,
            "at": observed_at,
            "notes": act_note,
            "now": now,
        },
    )
    await db.commit()

    return await get_issue(issue_id, db, user)


@router.get("/issues/{issue_id}", response_model=IssueOut)
async def get_issue(
    issue_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve issue detail with location and property labels."""
    sql = text(
        """
        SELECT i.*,
               l.location_code,
               l.name AS location_name,
               p.name AS property_name,
               prev.description AS previous_issue_description
        FROM location_issues i
        JOIN permanent_hazard_locations l ON i.location_id = l.id
        JOIN properties p ON l.property_id = p.id
        LEFT JOIN location_issues prev ON i.previous_issue_id = prev.id
        WHERE i.id = :id
        """
    )
    row = (await db.execute(sql, {"id": issue_id})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Issue not found")
    return IssueOut(**dict(row))


@router.get("/locations/{location_id}/issues", response_model=List[IssueOut])
async def list_location_issues(
    location_id: str,
    status_filter: Optional[str] = Query("all", alias="status"),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List issues for a permanent hazard location."""
    query = [
        """
        SELECT i.*,
               l.location_code,
               l.name AS location_name,
               p.name AS property_name,
               prev.description AS previous_issue_description
        FROM location_issues i
        JOIN permanent_hazard_locations l ON i.location_id = l.id
        JOIN properties p ON l.property_id = p.id
        LEFT JOIN location_issues prev ON i.previous_issue_id = prev.id
        WHERE i.location_id = :loc_id
        """
    ]
    params = {"loc_id": location_id}

    if status_filter and status_filter != "all":
        query.append("AND i.status = :status")
        params["status"] = status_filter

    query.append("ORDER BY i.observed_at DESC, i.created_at DESC")
    rows = (await db.execute(text(" ".join(query)), params)).mappings().all()
    return [IssueOut(**dict(r)) for r in rows]


@router.post("/issues/{issue_id}/resolve", response_model=IssueOut)
async def resolve_issue(
    issue_id: str,
    payload: IssueResolveRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Explicitly resolve an issue with audit attribution.
    Do not automatically resolve just because an inspection or cleanup occurred.
    """
    issue = (
        await db.execute(
            text("SELECT * FROM location_issues WHERE id = :id"),
            {"id": issue_id},
        )
    ).mappings().first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    now = _now_iso()
    await db.execute(
        text(
            """
            UPDATE location_issues
            SET status = 'resolved',
                resolved_at = :now,
                resolution_notes = :notes,
                resolved_by = :by,
                updated_at = :now
            WHERE id = :id
            """
        ),
        {
            "id": issue_id,
            "now": now,
            "notes": payload.resolution_notes.strip(),
            "by": payload.resolved_by.strip(),
        },
    )

    await db.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            (:id, :loc_id, :issue_id, 'resolution', :by, :now, :notes, :now)
            """
        ),
        {
            "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "loc_id": issue["location_id"],
            "issue_id": issue_id,
            "by": payload.resolved_by.strip(),
            "now": now,
            "notes": f"Issue marked resolved: {payload.resolution_notes.strip()}",
        },
    )
    await db.commit()

    try:
        from services.reinspection_scheduler import ReinspectionScheduler
        await ReinspectionScheduler.evaluate_location(db, issue["location_id"])
    except Exception as eval_err:
        print(f"Post-resolution scheduling evaluation notice: {eval_err}")

    return await get_issue(issue_id, db, user)


@router.post("/issues/{issue_id}/confirm-recurrence", response_model=IssueOut)
async def confirm_issue_recurrence(
    issue_id: str,
    payload: ConfirmRecurrenceRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Human-confirmed link indicating that this new problem is a recurrence of an
    earlier resolved problem at the same physical location.
    """
    issue = (
        await db.execute(
            text("SELECT * FROM location_issues WHERE id = :id"),
            {"id": issue_id},
        )
    ).mappings().first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    prev_issue = (
        await db.execute(
            text("SELECT * FROM location_issues WHERE id = :id"),
            {"id": payload.previous_issue_id},
        )
    ).mappings().first()
    if not prev_issue:
        raise HTTPException(status_code=400, detail="Previous issue record not found")

    if prev_issue["location_id"] != issue["location_id"]:
        raise HTTPException(
            status_code=400,
            detail="A recurrence can only link to a previous issue at the EXACT SAME physical location.",
        )

    if prev_issue["status"] != "resolved":
        raise HTTPException(
            status_code=400,
            detail="The previous issue must be marked 'resolved' to qualify as a recurrence. An ongoing issue is an existing open problem.",
        )

    now = _now_iso()
    await db.execute(
        text(
            """
            UPDATE location_issues
            SET is_recurrence = 1,
                previous_issue_id = :prev_id,
                recurrence_confirmed_by = :by,
                recurrence_confirmed_at = :now,
                updated_at = :now
            WHERE id = :id
            """
        ),
        {
            "id": issue_id,
            "prev_id": payload.previous_issue_id,
            "by": payload.confirmed_by.strip(),
            "now": now,
        },
    )

    await db.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            (:id, :loc_id, :issue_id, 'recurrence_flagged', :by, :now, :notes, :now)
            """
        ),
        {
            "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "loc_id": issue["location_id"],
            "issue_id": issue_id,
            "by": payload.confirmed_by.strip(),
            "now": now,
            "notes": (
                f"Recurrence confirmed: linked to earlier resolved issue ({payload.previous_issue_id}). "
                f"Notes: {payload.notes or 'Problem returned after earlier clearance.'}"
            ),
        },
    )
    await db.commit()

    try:
        from services.reinspection_scheduler import ReinspectionScheduler
        await ReinspectionScheduler.evaluate_location(db, issue["location_id"])
    except Exception as eval_err:
        print(f"Post-recurrence scheduling evaluation notice: {eval_err}")

    return await get_issue(issue_id, db, user)


# ============================================================================
# FEATURE D (CONT) — LOCATION MAINTENANCE ACTIVITIES
# ============================================================================
@router.post(
    "/locations/{location_id}/activities",
    response_model=ActivityOut,
    status_code=status.HTTP_201_CREATED,
)
async def record_activity(
    location_id: str,
    payload: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Record manual maintenance or field intervention (cleaning, larviciding, repairs)."""
    loc_exists = (
        await db.execute(
            text("SELECT 1 FROM permanent_hazard_locations WHERE id = :id"),
            {"id": location_id},
        )
    ).scalar()
    if not loc_exists:
        raise HTTPException(status_code=404, detail="Hazard location not found")

    act_id = f"ACT-{uuid.uuid4().hex[:8].upper()}"
    now = _now_iso()
    perf_at = payload.performed_at or now

    await db.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            (:id, :loc_id, :issue_id, :type, :by, :at, :notes, :now)
            """
        ),
        {
            "id": act_id,
            "loc_id": location_id,
            "issue_id": payload.issue_id,
            "type": payload.activity_type,
            "by": payload.performed_by.strip(),
            "at": perf_at,
            "notes": payload.notes,
            "now": now,
        },
    )
    await db.commit()

    return ActivityOut(
        id=act_id,
        location_id=location_id,
        issue_id=payload.issue_id,
        activity_type=payload.activity_type,
        performed_by=payload.performed_by.strip(),
        performed_at=perf_at,
        notes=payload.notes,
        created_at=now,
    )


@router.get("/locations/{location_id}/activities", response_model=List[ActivityOut])
async def list_activities(
    location_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List all recorded activities for a location."""
    rows = (
        await db.execute(
            text(
                "SELECT * FROM location_activities WHERE location_id = :loc_id ORDER BY performed_at DESC, created_at DESC"
            ),
            {"loc_id": location_id},
        )
    ).mappings().all()
    return [ActivityOut(**dict(r)) for r in rows]


# ============================================================================
# FEATURE F — PERMANENT LOCATION TIMELINE
# ============================================================================
@router.get("/locations/{location_id}/timeline", response_model=LocationTimelineOut)
async def get_location_timeline(
    location_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Returns complete chronological history of a registered hazard location:
    inspections, findings, resolutions, maintenance actions, and linked citizen reports.
    Data is generated directly from stored database rows, not mock events.
    """
    location = await get_hazard_location(location_id, db, user)

    events: List[TimelineEvent] = []

    # 1. Location registration
    events.append(
        TimelineEvent(
            id=f"evt_reg_{location.id}",
            timestamp=location.created_at,
            event_type="registration",
            title=f"Location Registered: {location.name} ({location.location_code})",
            description=f"Permanent inspection point registered in {location.property_name}. Zone: {location.floor_zone or 'N/A'}.",
            performed_by="System Administrator",
            status="active",
            metadata={"location_code": location.location_code, "category": location.category},
        )
    )

    # 2. Inspections
    insp_rows = (
        await db.execute(
            text("SELECT * FROM location_inspections WHERE location_id = :id ORDER BY inspection_date ASC"),
            {"id": location_id},
        )
    ).mappings().all()

    for row in insp_rows:
        res = row["result"]
        title_map = {
            "clear": "Inspection Conducted: Clear",
            "problem_found": "Inspection Conducted: Problem Identified",
            "unable_to_inspect": "Inspection Attempted: Unable to Inspect",
        }
        events.append(
            TimelineEvent(
                id=f"evt_insp_{row['id']}",
                timestamp=row["inspection_date"],
                event_type="inspection",
                title=title_map.get(res, f"Inspection: {res}"),
                description=row["notes"] or row["problem_identified"] or "On-site check performed.",
                performed_by=f"{row['inspector_name']} ({row['inspector_role'] or 'Inspector'})",
                status=res,
                metadata={
                    "inspection_id": row["id"],
                    "result": res,
                    "evidence_notes": row["evidence_notes"],
                    "weather": row["weather_conditions"],
                },
            )
        )

    # 3. Issues & Findings
    issue_rows = (
        await db.execute(
            text("SELECT * FROM location_issues WHERE location_id = :id ORDER BY observed_at ASC"),
            {"id": location_id},
        )
    ).mappings().all()

    for row in issue_rows:
        rec_label = " [RECURRENCE]" if row["is_recurrence"] else ""
        events.append(
            TimelineEvent(
                id=f"evt_iss_{row['id']}",
                timestamp=row["observed_at"],
                event_type="issue_reported",
                title=f"Hazard Reported: {row['issue_type'].replace('_', ' ').title()}{rec_label}",
                description=row["description"],
                performed_by=row["recurrence_confirmed_by"] or "Field Inspector / Citizen Report Link",
                status=row["status"],
                metadata={
                    "issue_id": row["id"],
                    "severity": row["severity"],
                    "is_recurrence": bool(row["is_recurrence"]),
                    "previous_issue_id": row["previous_issue_id"],
                },
            )
        )
        if row["status"] == "resolved" and row["resolved_at"]:
            events.append(
                TimelineEvent(
                    id=f"evt_res_{row['id']}",
                    timestamp=row["resolved_at"],
                    event_type="issue_resolved",
                    title=f"Hazard Resolved: {row['issue_type'].replace('_', ' ').title()}",
                    description=row["resolution_notes"] or "Issue marked resolved by authority.",
                    performed_by=row["resolved_by"] or "Authority Supervisor",
                    status="resolved",
                    metadata={"issue_id": row["id"]},
                )
            )

    # 4. Activities (maintenance, cleanings, larvicide)
    act_rows = (
        await db.execute(
            text(
                """
                SELECT * FROM location_activities
                WHERE location_id = :id AND activity_type NOT IN ('registration', 'inspection', 'resolution', 'issue_opened')
                ORDER BY performed_at ASC
                """
            ),
            {"id": location_id},
        )
    ).mappings().all()

    for row in act_rows:
        events.append(
            TimelineEvent(
                id=f"evt_act_{row['id']}",
                timestamp=row["performed_at"],
                event_type="activity",
                title=f"Action: {row['activity_type'].replace('_', ' ').title()}",
                description=row["notes"] or "Maintenance action executed.",
                performed_by=row["performed_by"],
                status="completed",
                metadata={"activity_id": row["id"], "type": row["activity_type"]},
            )
        )

    # 5. Linked citizen reports
    link_rows = (
        await db.execute(
            text(
                """
                SELECT lk.*, cr.submitted_at, cr.photo_path
                FROM citizen_report_location_links lk
                JOIN citizen_reports cr ON lk.report_id = cr.id
                WHERE lk.location_id = :id
                ORDER BY lk.linked_at ASC
                """
            ),
            {"id": location_id},
        )
    ).mappings().all()

    for row in link_rows:
        events.append(
            TimelineEvent(
                id=f"evt_link_{row['id']}",
                timestamp=row["linked_at"],
                event_type="citizen_report_linked",
                title=f"Citizen Report #{row['report_id']} Associated",
                description=(
                    f"Citizen report originally submitted at {row['submitted_at']} confirmed to this location. "
                    f"Notes: {row['notes'] or 'Human confirmed.'}"
                ),
                performed_by=row["linked_by"],
                status=row["status"],
                metadata={"report_id": row["report_id"], "link_id": row["id"]},
            )
        )

    events.sort(key=lambda e: e.timestamp, reverse=True)

    return LocationTimelineOut(location=location, events=events)


# ============================================================================
# FEATURE E — LINK EXISTING CITIZEN REPORTS
# ============================================================================
@router.get("/citizen-reports", response_model=List[CitizenReportWithLocation])
async def list_citizen_reports_for_association(
    ward_id: Optional[str] = None,
    assignment_status: Optional[str] = Query("all", description="'all', 'assigned', or 'unassigned'"),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Review existing citizen reports with their location associations.
    Important:
      1. Unlinked reports remain unassigned (no invented coordinates).
      2. Shows candidate registered hazard locations in the same ward for human confirmation.
      3. Original citizen_reports table is preserved without modification.
    """
    query_parts = [
        """
        SELECT cr.id, cr.ward_id, cr.photo_path, cr.yolo_confidence,
               cr.verified, cr.points_awarded, cr.submitted_at,
               lk.id AS link_id, lk.location_id, lk.linked_by, lk.linked_at,
               lk.notes AS link_notes, lk.status AS link_status,
               loc.location_code, loc.name AS location_name, loc.property_id,
               prop.name AS property_name
        FROM citizen_reports cr
        LEFT JOIN citizen_report_location_links lk ON cr.id = lk.report_id AND lk.status = 'confirmed'
        LEFT JOIN permanent_hazard_locations loc ON lk.location_id = loc.id
        LEFT JOIN properties prop ON loc.property_id = prop.id
        WHERE 1=1
        """
    ]
    params = {}

    if ward_id:
        query_parts.append("AND cr.ward_id = :ward_id")
        params["ward_id"] = ward_id

    if assignment_status == "assigned":
        query_parts.append("AND lk.location_id IS NOT NULL")
    elif assignment_status == "unassigned":
        query_parts.append("AND lk.location_id IS NULL")

    query_parts.append("ORDER BY cr.submitted_at DESC LIMIT 100")

    rows = (await db.execute(text(" ".join(query_parts)), params)).mappings().all()

    candidate_locations_by_ward: dict[str, list] = {}
    loc_rows = (
        await db.execute(
            text(
                """
                SELECT l.id, l.location_code, l.name, l.category, l.floor_zone,
                       p.id AS property_id, p.name AS property_name, p.ward_id
                FROM permanent_hazard_locations l
                JOIN properties p ON l.property_id = p.id
                WHERE l.status = 'active'
                """
            )
        )
    ).mappings().all()

    for lr in loc_rows:
        w = lr["ward_id"]
        candidate_locations_by_ward.setdefault(w, []).append(
            {
                "location_id": lr["id"],
                "location_code": lr["location_code"],
                "name": lr["name"],
                "category": lr["category"],
                "floor_zone": lr["floor_zone"],
                "property_id": lr["property_id"],
                "property_name": lr["property_name"],
            }
        )

    results: List[CitizenReportWithLocation] = []
    for r in rows:
        d = dict(r)
        d["ward_name"] = _get_ward_name(d["ward_id"])
        d["candidate_locations"] = candidate_locations_by_ward.get(d["ward_id"], [])
        results.append(CitizenReportWithLocation(**d))

    return results


@router.post("/citizen-reports/{report_id}/link", status_code=status.HTTP_200_OK)
async def link_citizen_report_to_location(
    report_id: int,
    payload: CitizenReportLinkRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Manually associate a citizen report to a permanent hazard location.
    Requires human confirmation; records reviewer name and timestamp.
    """
    report = (
        await db.execute(
            text("SELECT id, ward_id FROM citizen_reports WHERE id = :id"),
            {"id": report_id},
        )
    ).mappings().first()
    if not report:
        raise HTTPException(status_code=404, detail="Citizen report not found")

    loc = (
        await db.execute(
            text(
                """
                SELECT l.id, l.location_code, l.name, p.name AS property_name, p.ward_id
                FROM permanent_hazard_locations l
                JOIN properties p ON l.property_id = p.id
                WHERE l.id = :id
                """
            ),
            {"id": payload.location_id},
        )
    ).mappings().first()
    if not loc:
        raise HTTPException(status_code=404, detail="Target hazard location not found")

    now = _now_iso()

    await db.execute(
        text(
            """
            UPDATE citizen_report_location_links
            SET status = 'revoked', updated_at = :now
            WHERE report_id = :rep_id AND status = 'confirmed'
            """
        ),
        {"rep_id": report_id, "now": now},
    )

    link_id = f"LINK-{uuid.uuid4().hex[:8].upper()}"
    await db.execute(
        text(
            """
            INSERT INTO citizen_report_location_links
            (id, report_id, location_id, linked_by, linked_at, notes, status, created_at, updated_at)
            VALUES
            (:id, :rep_id, :loc_id, :by, :now, :notes, 'confirmed', :now, :now)
            """
        ),
        {
            "id": link_id,
            "rep_id": report_id,
            "loc_id": payload.location_id,
            "by": payload.linked_by.strip(),
            "now": now,
            "notes": payload.notes or f"Confirmed by {user.display_name}",
        },
    )

    await db.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            (:id, :loc_id, 'citizen_report_link', :by, :now, :notes, :now)
            """
        ),
        {
            "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "loc_id": payload.location_id,
            "by": payload.linked_by.strip(),
            "now": now,
            "notes": f"Citizen report #{report_id} linked to location. Notes: {payload.notes or 'Human review verified.'}",
        },
    )
    await db.commit()

    return {
        "status": "success",
        "message": f"Citizen report #{report_id} successfully linked to {loc['name']} ({loc['location_code']}).",
        "link_id": link_id,
        "report_id": report_id,
        "location_id": payload.location_id,
        "linked_by": payload.linked_by.strip(),
        "linked_at": now,
    }


@router.post("/citizen-reports/{report_id}/unlink", status_code=status.HTTP_200_OK)
async def unlink_citizen_report(
    report_id: int,
    reason: Optional[str] = Query("Correction by authority reviewer"),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Revoke or correct an erroneous citizen report link with audit log.
    """
    link = (
        await db.execute(
            text(
                "SELECT * FROM citizen_report_location_links WHERE report_id = :rep_id AND status = 'confirmed'"
            ),
            {"rep_id": report_id},
        )
    ).mappings().first()
    if not link:
        raise HTTPException(status_code=404, detail="No active location link found for this citizen report")

    now = _now_iso()
    await db.execute(
        text(
            "UPDATE citizen_report_location_links SET status = 'revoked', updated_at = :now WHERE id = :id"
        ),
        {"id": link["id"], "now": now},
    )

    await db.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            (:id, :loc_id, 'status_change', :by, :now, :notes, :now)
            """
        ),
        {
            "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "loc_id": link["location_id"],
            "by": user.display_name,
            "now": now,
            "notes": f"Association with citizen report #{report_id} revoked. Reason: {reason}",
        },
    )
    await db.commit()

    return {
        "status": "success",
        "message": f"Association between citizen report #{report_id} and location was revoked.",
        "report_id": report_id,
    }
