"""
Seed data for Improvement 03 — Service and Resolution Verification.
Initializes realistic service work orders across Dhaka properties representing
each state of the two-stage lifecycle:
- Assigned & in progress
- Evidence submitted awaiting supervisor review
- Work verified awaiting follow-up
- Resolution confirmed at follow-up
- Follow-up failed (issue remained present)
"""

from datetime import datetime, date, timedelta, timezone
import hashlib
import os
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _days_future(days: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()[:10]


async def seed_services_if_empty(db: AsyncSession):
    """Seed initial service work orders and evidence if table is empty."""
    count = (await db.execute(text("SELECT count(*) FROM service_work_orders"))).scalar() or 0
    if count > 0:
        return

    # Check that properties and locations exist
    loc_res = await db.execute(
        text("SELECT id, property_id, location_code FROM permanent_hazard_locations ORDER BY id ASC")
    )
    locs = loc_res.mappings().all()
    if not locs:
        return

    loc_mirpur = locs[0]  # e.g., B-NORTH-DRAIN-07
    loc_tejgaon = locs[1] if len(locs) > 1 else locs[0]
    loc_mohakhali = locs[2] if len(locs) > 2 else locs[0]

    # Ensure uploads/service_evidence directory exists
    evidence_dir = os.path.join("uploads", "service_evidence")
    os.makedirs(evidence_dir, exist_ok=True)

    # Create dummy sample evidence image files with deterministic hashes
    sample_file1_path = os.path.join(evidence_dir, "sample_after_clear_drain.jpg")
    if not os.path.exists(sample_file1_path):
        with open(sample_file1_path, "wb") as f:
            f.write(b"SAMPLE_IMAGE_DATA_CLEANED_ROOF_DRAIN_SURFACE_PONDING_REMOVED_2026")

    sample_file2_path = os.path.join(evidence_dir, "sample_larvicide_application.jpg")
    if not os.path.exists(sample_file2_path):
        with open(sample_file2_path, "wb") as f:
            f.write(b"SAMPLE_IMAGE_DATA_LARVICIDE_GRANULES_APPLIED_SUMP_PIT_2026")

    with open(sample_file1_path, "rb") as f:
        hash1 = hashlib.sha256(f.read()).hexdigest()
    with open(sample_file2_path, "rb") as f:
        hash2 = hashlib.sha256(f.read()).hexdigest()

    now_str = _now_iso()

    # 1. Work Order 1: Evidence Submitted, Awaiting Supervisor Review
    wo1_id = "WO-MIR-2026-001"
    sub1_id = "SUB-MIR-001"
    file1_id = "FILE-MIR-001"
    await db.execute(
        text("""
            INSERT INTO service_work_orders
            (id, property_id, location_id, title, description, required_action,
             priority, assigned_worker_name, assigned_contractor, responsible_supervisor,
             due_date, status, resolution_verification_status, action_performed,
             action_summary, materials_used, labor_hours, actual_cost, currency,
             repair_classification, started_at, completed_at, created_at, updated_at)
            VALUES
            (:id, :prop_id, :loc_id, :title, :desc, :act,
             'high', 'Kamal Hossain', 'Bengal CleanCare Services Ltd.', 'Supervisor Tariqul Islam',
             :due, 'evidence_submitted', 'awaiting_followup', 'cleaned',
             'Cleared 20kg sludge and standing water from roof drain gutter. Unblocked downspout.',
             '500ml Abate 1-SG larvicide, drainage rod, pressure hose', 3.5, 3500.0, 'BDT',
             'routine_maintenance', :start, :comp, :created, :created)
        """),
        {
            "id": wo1_id,
            "prop_id": loc_mirpur["property_id"],
            "loc_id": loc_mirpur["id"],
            "title": "Clear Stagnant Water & Sludge from North Roof Drain",
            "desc": "Recurring pooling identified following 38.5mm BMD rainfall. Immediate clearing required.",
            "act": "clean_drain",
            "due": _days_future(2),
            "start": _days_ago(1),
            "comp": _days_ago(0),
            "created": _days_ago(2),
        }
    )

    await db.execute(
        text("""
            INSERT INTO service_evidence_submissions
            (id, work_order_id, submission_version, submitted_by, action_type,
             work_description, materials_used, submitted_at, supervisor_decision)
            VALUES
            (:id, :wo_id, 1, 'Kamal Hossain', 'cleaned',
             'Cleared 20kg sediment, flushed downpipe, and verified free gravity drainage.',
             '500ml Abate 1-SG larvicide, high-pressure nozzle', :now, 'pending')
        """),
        {"id": sub1_id, "wo_id": wo1_id, "now": _days_ago(0)}
    )

    await db.execute(
        text("""
            INSERT INTO service_evidence_files
            (id, submission_id, work_order_id, evidence_category, file_path,
             original_filename, file_size_bytes, mime_type, file_sha256,
             is_duplicate_flag, server_received_at, description)
            VALUES
            (:id, :sub_id, :wo_id, 'after_photo', :path,
             'clear_roof_drain_after.jpg', 64, 'image/jpeg', :hash,
             0, :now, 'After-service photo showing fully cleared downspout and dry channel.')
        """),
        {
            "id": file1_id,
            "sub_id": sub1_id,
            "wo_id": wo1_id,
            "path": sample_file1_path,
            "hash": hash1,
            "now": _days_ago(0),
        }
    )

    # 2. Work Order 2: Work Verified, Resolution Confirmed at Follow-up
    wo2_id = "WO-TEJ-2026-002"
    sub2_id = "SUB-TEJ-002"
    file2_id = "FILE-TEJ-002"
    res2_id = "RES-TEJ-002"
    insp2_id = "INSP-TEJ-VERIF-01"

    await db.execute(
        text("""
            INSERT INTO service_work_orders
            (id, property_id, location_id, title, description, required_action,
             priority, assigned_worker_name, assigned_contractor, responsible_supervisor,
             due_date, status, resolution_verification_status, action_performed,
             action_summary, materials_used, labor_hours, actual_cost, currency,
             repair_classification, started_at, completed_at, verified_at, created_at, updated_at)
            VALUES
            (:id, :prop_id, :loc_id, :title, :desc, :act,
             'medium', 'Nurul Amin', 'Dhaka Vector Shield Ltd.', 'Supervisor Tariqul Islam',
             :due, 'work_verified', 'resolution_confirmed', 'larvicide_applied',
             'Applied slow-release temephos granules across basement sump pit.',
             'Temephos 1% granules 200g', 2.0, 2200.0, 'BDT',
             'temporary_mitigation', :start, :comp, :ver, :created, :now)
        """),
        {
            "id": wo2_id,
            "prop_id": loc_tejgaon["property_id"],
            "loc_id": loc_tejgaon["id"],
            "title": "Larvicide Application in Basement Drainage Sump",
            "desc": "Heavy stagnant water in enclosed sump pit. Larvicide application requested.",
            "act": "apply_larvicide",
            "due": _days_ago(3),
            "start": _days_ago(5),
            "comp": _days_ago(4),
            "ver": _days_ago(4),
            "created": _days_ago(6),
            "now": now_str,
        }
    )

    await db.execute(
        text("""
            INSERT INTO service_evidence_submissions
            (id, work_order_id, submission_version, submitted_by, action_type,
             work_description, materials_used, submitted_at, supervisor_decision,
             decision_notes, decided_by, decided_at)
            VALUES
            (:id, :wo_id, 1, 'Nurul Amin', 'larvicide_applied',
             'Evenly distributed 200g temephos granules across 15 sq meter water surface.',
             'Temephos 1% granules 200g', :sub_at, 'accepted',
             'Photographs confirm correct granule dispersion and water containment.',
             'Supervisor Tariqul Islam', :dec_at)
        """),
        {
            "id": sub2_id,
            "wo_id": wo2_id,
            "sub_at": _days_ago(4),
            "dec_at": _days_ago(4),
        }
    )

    await db.execute(
        text("""
            INSERT INTO service_evidence_files
            (id, submission_id, work_order_id, evidence_category, file_path,
             original_filename, file_size_bytes, mime_type, file_sha256,
             is_duplicate_flag, server_received_at, description)
            VALUES
            (:id, :sub_id, :wo_id, 'during_photo', :path,
             'sump_larvicide_treatment.jpg', 61, 'image/jpeg', :hash,
             0, :now, 'Photograph showing treatment application in progress.')
        """),
        {
            "id": file2_id,
            "sub_id": sub2_id,
            "wo_id": wo2_id,
            "path": sample_file2_path,
            "hash": hash2,
            "now": _days_ago(4),
        }
    )

    # Resolution confirmation record
    await db.execute(
        text("""
            INSERT INTO resolution_verification_records
            (id, work_order_id, location_id, followup_inspection_id, verified_outcome,
             verified_by, verified_at, verification_notes, issue_status_after, created_at)
            VALUES
            (:id, :wo_id, :loc_id, :insp_id, 'clear',
             'QA Inspector Mahbub', :ver_at,
             'Follow-up visit 3 days post-treatment confirmed 100% mortality of larvae. Water surface clear of pupae.',
             'resolved', :ver_at)
        """),
        {
            "id": res2_id,
            "wo_id": wo2_id,
            "loc_id": loc_tejgaon["id"],
            "insp_id": insp2_id,
            "ver_at": _days_ago(1),
        }
    )

    # 3. Work Order 3: Assigned & In Progress
    wo3_id = "WO-MOH-2026-003"
    await db.execute(
        text("""
            INSERT INTO service_work_orders
            (id, property_id, location_id, title, description, required_action,
             priority, assigned_worker_name, assigned_contractor, responsible_supervisor,
             due_date, status, resolution_verification_status, started_at, created_at, updated_at)
            VALUES
            (:id, :prop_id, :loc_id, :title, :desc, 'repair_component',
             'critical', 'Shafiqul Islam', 'City Environmental Defense', 'Supervisor Tariqul Islam',
             :due, 'in_progress', 'awaiting_followup', :now, :now, :now)
        """),
        {
            "id": wo3_id,
            "prop_id": loc_mohakhali["property_id"],
            "loc_id": loc_mohakhali["id"],
            "title": "Install Mosquito-Proof Mesh on Overhead Water Storage Tank",
            "desc": "Inspection revealed damaged inspection hatch seal allowing mosquito oviposition.",
            "due": _days_future(1),
            "now": now_str,
        }
    )

    await db.commit()
