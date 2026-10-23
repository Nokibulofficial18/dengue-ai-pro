"""
Router for Improvement 03 — Service and Resolution Verification.
Exposes REST endpoints for property-level service work orders, field worker
evidence submissions with cryptographic duplicate image detection,
supervisor review queues, and independent follow-up resolution confirmations.
"""

from datetime import datetime, date, timezone
import hashlib
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from models.service_schemas import (
    EvidenceFileOut,
    EvidenceSubmissionCreate,
    EvidenceSubmissionOut,
    FollowupResolutionRequest,
    ResolutionRecordOut,
    ServiceStatsOut,
    SupervisorReviewRequest,
    WorkOrderCreate,
    WorkOrderOut,
    WorkOrderStatusHistoryOut,
    WorkOrderStatusUpdate,
)
from services.service_verifier import ServiceVerifier, calculate_sha256, _now_iso, _today_str
from utils.auth import AuthorityUser, get_current_authority_user

router = APIRouter(prefix="/services", tags=["Service & Resolution Verification"])

EVIDENCE_UPLOAD_DIR = os.path.join("uploads", "service_evidence")
os.makedirs(EVIDENCE_UPLOAD_DIR, exist_ok=True)


# ============================================================================
# WORK ORDERS CRUD ENDPOINTS
# ============================================================================
@router.get("/work-orders", response_model=List[WorkOrderOut])
async def list_work_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    resolution_status: Optional[str] = Query(None),
    property_id: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    assigned_worker: Optional[str] = Query(None),
    assigned_contractor: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List service work orders with dynamic filtering."""
    conditions = []
    params: Dict[str, Any] = {}

    if status_filter and status_filter != "all":
        conditions.append("wo.status = :status_filter")
        params["status_filter"] = status_filter
    if resolution_status and resolution_status != "all":
        conditions.append("wo.resolution_verification_status = :res_status")
        params["res_status"] = resolution_status
    if property_id and property_id != "all":
        conditions.append("wo.property_id = :property_id")
        params["property_id"] = property_id
    if location_id and location_id != "all":
        conditions.append("wo.location_id = :location_id")
        params["location_id"] = location_id
    if assigned_worker:
        conditions.append("LOWER(wo.assigned_worker_name) LIKE :worker")
        params["worker"] = f"%{assigned_worker.lower()}%"
    if assigned_contractor:
        conditions.append("LOWER(wo.assigned_contractor) LIKE :contractor")
        params["contractor"] = f"%{assigned_contractor.lower()}%"
    if priority and priority != "all":
        conditions.append("wo.priority = :priority")
        params["priority"] = priority

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = text(f"""
        SELECT wo.id
        FROM service_work_orders wo
        JOIN properties p ON wo.property_id = p.id
        JOIN permanent_hazard_locations l ON wo.location_id = l.id
        {where}
        ORDER BY
            CASE wo.status
                WHEN 'evidence_submitted' THEN 1
                WHEN 'in_progress' THEN 2
                WHEN 'assigned' THEN 3
                WHEN 'clarification_required' THEN 4
                WHEN 'work_verified' THEN 5
                ELSE 6
            END ASC,
            wo.due_date ASC
    """)
    res = await db.execute(query, params)
    ids = [r[0] for r in res.fetchall()]

    out = []
    for wo_id in ids:
        detail = await ServiceVerifier.get_work_order_detail(db, wo_id)
        if detail:
            out.append(WorkOrderOut(**detail))
    return out


@router.post("/work-orders", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    payload: WorkOrderCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Create and assign a new property-level service work order."""
    try:
        data = payload.model_dump()
        created = await ServiceVerifier.create_work_order(db, data, user.display_name or user.username)
        return WorkOrderOut(**created)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(
    work_order_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve full work order profile with evidence and resolution audit."""
    wo = await ServiceVerifier.get_work_order_detail(db, work_order_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return WorkOrderOut(**wo)


@router.post("/work-orders/{work_order_id}/start", response_model=WorkOrderOut)
async def start_work_order(
    work_order_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Field worker marks task started on site."""
    try:
        updated = await ServiceVerifier.start_work_order(db, work_order_id, user.display_name or user.username)
        return WorkOrderOut(**updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/work-orders/{work_order_id}/status", response_model=WorkOrderOut)
async def update_work_order_status(
    work_order_id: str,
    payload: WorkOrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Update status (e.g. cancelled)."""
    wo = await ServiceVerifier.get_work_order_detail(db, work_order_id)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    now_str = _now_iso()
    await db.execute(
        text("UPDATE service_work_orders SET status = :st, updated_at = :now WHERE id = :id"),
        {"st": payload.to_status, "now": now_str, "id": work_order_id}
    )
    await db.execute(
        text("""
            INSERT INTO work_order_status_history
            (id, work_order_id, from_status, to_status, changed_by, changed_at, notes)
            VALUES
            (:id, :wo_id, :from_st, :to_st, :by, :now, :notes)
        """),
        {
            "id": f"WOSH-{uuid.uuid4().hex[:8].upper()}",
            "wo_id": work_order_id,
            "from_st": wo["status"],
            "to_st": payload.to_status,
            "by": user.display_name or user.username,
            "now": now_str,
            "notes": payload.notes,
        }
    )
    await db.commit()
    updated = await ServiceVerifier.get_work_order_detail(db, work_order_id)
    return WorkOrderOut(**updated)


# ============================================================================
# EVIDENCE SUBMISSION & SECURE FILE HANDLING
# ============================================================================
@router.post("/work-orders/{work_order_id}/submit-evidence", response_model=WorkOrderOut)
async def submit_work_order_evidence(
    work_order_id: str,
    action_type: str = Form(...),
    work_description: str = Form(...),
    materials_used: Optional[str] = Form(None),
    unresolved_notes: Optional[str] = Form(None),
    access_restricted: bool = Form(False),
    labor_hours: Optional[float] = Form(None),
    actual_cost: Optional[float] = Form(None),
    evidence_category: Optional[str] = Form("after_photo"),
    files: List[UploadFile] = File([]),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Field worker submits service completion report with attached photos/documents.
    Validates file formats, computes SHA256 hashes, and detects duplicate submissions.
    """
    stored_files_meta = []
    for upload in files:
        if not upload.filename:
            continue

        ext = os.path.splitext(upload.filename)[1].lower()
        allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".mp4"}
        if ext not in allowed_exts:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{ext}'. Allowed formats: JPG, PNG, WEBP, PDF."
            )

        content = await upload.read()
        if len(content) > 25 * 1024 * 1024:  # 25 MB limit
            raise HTTPException(status_code=400, detail="File size exceeds maximum allowed 25MB limit.")

        sha256 = calculate_sha256(content)
        safe_filename = f"{work_order_id}_{uuid.uuid4().hex[:6]}{ext}"
        target_path = os.path.join(EVIDENCE_UPLOAD_DIR, safe_filename)

        with open(target_path, "wb") as f_out:
            f_out.write(content)

        stored_files_meta.append({
            "path": target_path,
            "filename": upload.filename,
            "size": len(content),
            "mime": upload.content_type or "application/octet-stream",
            "sha256": sha256,
            "category": evidence_category or "after_photo",
            "client_captured_at": _now_iso(),
            "description": f"Field evidence uploaded for {action_type}",
        })

    sub_dict = {
        "action_type": action_type,
        "work_description": work_description,
        "materials_used": materials_used,
        "unresolved_notes": unresolved_notes,
        "access_restricted": access_restricted,
        "labor_hours": labor_hours,
        "actual_cost": actual_cost,
    }

    try:
        updated = await ServiceVerifier.submit_evidence(
            db=db,
            work_order_id=work_order_id,
            submission_data=sub_dict,
            files=stored_files_meta,
            worker_name=user.display_name or user.username,
        )
        return WorkOrderOut(**updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/evidence/file/{file_id}")
async def get_evidence_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Secure file streaming endpoint.
    Restricts access to authenticated authority sessions and prevents path traversal.
    """
    res = await db.execute(
        text("SELECT file_path, original_filename, mime_type FROM service_evidence_files WHERE id = :id"),
        {"id": file_id}
    )
    row = res.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence file record not found")

    file_path = row["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server storage")

    return FileResponse(
        path=file_path,
        filename=row["original_filename"],
        media_type=row["mime_type"],
    )


# ============================================================================
# SUPERVISOR REVIEW ENDPOINTS
# ============================================================================
@router.get("/reviews/queue", response_model=List[WorkOrderOut])
async def get_supervisor_review_queue(
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve work orders with evidence submitted awaiting supervisor review."""
    query = text("""
        SELECT id FROM service_work_orders
        WHERE status = 'evidence_submitted'
        ORDER BY completed_at ASC
    """)
    res = await db.execute(query)
    ids = [r[0] for r in res.fetchall()]
    out = []
    for wo_id in ids:
        d = await ServiceVerifier.get_work_order_detail(db, wo_id)
        if d:
            out.append(WorkOrderOut(**d))
    return out


@router.post("/work-orders/{work_order_id}/review", response_model=WorkOrderOut)
async def review_work_order_evidence(
    work_order_id: str,
    payload: SupervisorReviewRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Supervisor evidence review:
    - 'accepted': Verifies work completion ('work_verified'). Sets resolution to 'awaiting_followup'.
    - 'clarification_required': Prompts worker to provide missing photos/notes.
    - 'rejected': Inadequate evidence.
    """
    # Enforce role-based access control (Step 16)
    if user.role not in ("supervisor", "authority_officer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only supervisors or authorized officers can review and verify service work orders."
        )

    try:
        updated = await ServiceVerifier.review_evidence(
            db=db,
            work_order_id=work_order_id,
            decision=payload.decision,
            decision_notes=payload.decision_notes,
            supervisor_name=user.display_name or user.username,
        )
        return WorkOrderOut(**updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# FOLLOW-UP RESOLUTION VERIFICATION ENDPOINTS
# ============================================================================
@router.get("/follow-up/queue", response_model=List[WorkOrderOut])
async def get_followup_queue(
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve verified work orders awaiting independent on-site follow-up check."""
    query = text("""
        SELECT id FROM service_work_orders
        WHERE status = 'work_verified'
          AND resolution_verification_status IN ('awaiting_followup', 'followup_scheduled')
        ORDER BY verified_at ASC
    """)
    res = await db.execute(query)
    ids = [r[0] for r in res.fetchall()]
    out = []
    for wo_id in ids:
        d = await ServiceVerifier.get_work_order_detail(db, wo_id)
        if d:
            out.append(WorkOrderOut(**d))
    return out


@router.post("/work-orders/{work_order_id}/record-followup", response_model=WorkOrderOut)
async def record_followup_resolution_endpoint(
    work_order_id: str,
    payload: FollowupResolutionRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Record independent follow-up inspection outcome.
    - 'clear': Resolution confirmed at follow-up (marks hazard issue as 'resolved').
    - 'problem_still_present': Interventions failed; hazard issue remains 'open'.
    - 'unable_to_inspect': Inconclusive.
    """
    # Enforce role-based access control (Step 16)
    if user.role not in ("inspector", "supervisor", "authority_officer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only inspectors or authorized supervisors can record follow-up resolution outcomes."
        )

    try:
        updated = await ServiceVerifier.record_followup_resolution(
            db=db,
            work_order_id=work_order_id,
            verified_outcome=payload.verified_outcome,
            verification_notes=payload.verification_notes,
            inspector_name=payload.inspector_name or user.display_name or user.username,
            evidence_notes=payload.evidence_notes,
        )
        return WorkOrderOut(**updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# OPERATIONAL STATISTICS ENDPOINTS
# ============================================================================
@router.get("/stats", response_model=ServiceStatsOut)
async def get_service_verification_statistics(
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve operational service verification metrics based on real database records."""
    stats = await ServiceVerifier.get_service_statistics(db)
    return ServiceStatsOut(**stats)


@router.get("/worker/tasks", response_model=List[WorkOrderOut])
async def get_worker_tasks(
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Retrieve work orders assigned to current user/worker."""
    worker_query = text("""
        SELECT id FROM service_work_orders
        WHERE (LOWER(assigned_worker_name) LIKE :w OR assigned_worker_id = :uid)
          AND status NOT IN ('work_verified', 'cancelled')
        ORDER BY due_date ASC
    """)
    res = await db.execute(worker_query, {"w": f"%{user.username.lower()}%", "uid": user.username})
    ids = [r[0] for r in res.fetchall()]
    out = []
    for wo_id in ids:
        d = await ServiceVerifier.get_work_order_detail(db, wo_id)
        if d:
            out.append(WorkOrderOut(**d))
    return out
