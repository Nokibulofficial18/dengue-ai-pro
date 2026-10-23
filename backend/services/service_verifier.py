"""
Service and Resolution Verification Service (Improvement 03).
Coordinates property-level work orders, evidence submission with duplicate-file
hashing, supervisor review verification, and independent follow-up
problem resolution confirmation.
"""

from datetime import datetime, date, timezone
import hashlib
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_str() -> str:
    return date.today().isoformat()


def calculate_sha256(content: bytes) -> str:
    """Compute cryptographic SHA256 checksum for duplicate image/file detection."""
    return hashlib.sha256(content).hexdigest()


class ServiceVerifier:
    """
    Orchestrates the two-stage verification lifecycle:
    Stage 1: Was the service work completed? (Worker Evidence -> Supervisor Review -> Work Verified)
    Stage 2: Did the hazard stay resolved? (Follow-up Inspection -> Clear Observation -> Resolution Confirmed)
    """

    @classmethod
    async def create_work_order(
        cls,
        db: AsyncSession,
        payload_dict: Dict[str, Any],
        creator_name: str
    ) -> Dict[str, Any]:
        """Create and assign a new property-level service work order."""
        # 1. Validate property & location
        loc_res = await db.execute(
            text("""
                SELECT l.id, l.property_id, l.location_code, l.name AS location_name,
                       p.ward_id, p.name AS property_name
                FROM permanent_hazard_locations l
                JOIN properties p ON l.property_id = p.id
                WHERE l.id = :loc_id
            """),
            {"loc_id": payload_dict["location_id"]}
        )
        loc = loc_res.mappings().first()
        if not loc:
            raise ValueError(f"Hazard location '{payload_dict['location_id']}' not found.")

        # Ensure property matches location's parent property
        if payload_dict.get("property_id") and payload_dict["property_id"] != loc["property_id"]:
            payload_dict["property_id"] = loc["property_id"]

        wo_id = f"WO-{uuid.uuid4().hex[:8].upper()}"
        now_str = _now_iso()

        # Insert work order
        await db.execute(
            text("""
                INSERT INTO service_work_orders
                (id, property_id, location_id, issue_id, recommendation_id,
                 scheduled_inspection_id, title, description, required_action,
                 priority, assigned_worker_id, assigned_worker_name,
                 assigned_contractor, responsible_supervisor, due_date,
                 status, resolution_verification_status, labor_hours, actual_cost,
                 currency, repair_classification, created_at, updated_at)
                VALUES
                (:id, :property_id, :location_id, :issue_id, :recommendation_id,
                 :scheduled_inspection_id, :title, :description, :required_action,
                 :priority, :assigned_worker_id, :assigned_worker_name,
                 :assigned_contractor, :responsible_supervisor, :due_date,
                 'assigned', 'awaiting_followup', :labor_hours, :actual_cost,
                 :currency, :repair_classification, :now, :now)
            """),
            {
                "id": wo_id,
                "property_id": loc["property_id"],
                "location_id": loc["id"],
                "issue_id": payload_dict.get("issue_id"),
                "recommendation_id": payload_dict.get("recommendation_id"),
                "scheduled_inspection_id": payload_dict.get("scheduled_inspection_id"),
                "title": payload_dict["title"].strip(),
                "description": payload_dict.get("description"),
                "required_action": payload_dict["required_action"],
                "priority": payload_dict.get("priority", "medium"),
                "assigned_worker_id": payload_dict.get("assigned_worker_id"),
                "assigned_worker_name": payload_dict["assigned_worker_name"].strip(),
                "assigned_contractor": payload_dict.get("assigned_contractor"),
                "responsible_supervisor": payload_dict["responsible_supervisor"].strip(),
                "due_date": payload_dict["due_date"],
                "labor_hours": payload_dict.get("labor_hours", 0.0) or 0.0,
                "actual_cost": payload_dict.get("actual_cost", 0.0) or 0.0,
                "currency": payload_dict.get("currency", "BDT"),
                "repair_classification": payload_dict.get("repair_classification", "temporary_mitigation"),
                "now": now_str,
            }
        )

        # Audit initial status
        await db.execute(
            text("""
                INSERT INTO work_order_status_history
                (id, work_order_id, from_status, to_status, changed_by, changed_at, notes)
                VALUES
                (:id, :wo_id, NULL, 'assigned', :by, :now, :notes)
            """),
            {
                "id": f"WOSH-{uuid.uuid4().hex[:8].upper()}",
                "wo_id": wo_id,
                "by": creator_name,
                "now": now_str,
                "notes": f"Work order created and assigned to {payload_dict['assigned_worker_name']}."
            }
        )

        # Add entry to location timeline
        await db.execute(
            text("""
                INSERT INTO location_activities
                (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
                VALUES
                (:id, :loc_id, :issue_id, 'work_order_assigned', :by, :now, :notes, :now)
            """),
            {
                "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
                "loc_id": loc["id"],
                "issue_id": payload_dict.get("issue_id"),
                "by": creator_name,
                "now": now_str,
                "notes": f"Work order #{wo_id} assigned: {payload_dict['title']} ({payload_dict['required_action']})."
            }
        )
        await db.commit()

        return await cls.get_work_order_detail(db, wo_id)

    @classmethod
    async def start_work_order(
        cls,
        db: AsyncSession,
        work_order_id: str,
        worker_name: str
    ) -> Dict[str, Any]:
        """Mark work order in progress upon worker arriving on site."""
        wo = await cls.get_work_order_detail(db, work_order_id)
        if not wo:
            raise ValueError("Work order not found.")
        if wo["status"] not in ("assigned", "clarification_required"):
            raise ValueError(f"Cannot start work order in '{wo['status']}' status.")

        now_str = _now_iso()
        await db.execute(
            text("""
                UPDATE service_work_orders
                SET status = 'in_progress',
                    started_at = CASE WHEN started_at IS NULL THEN :now ELSE started_at END,
                    updated_at = :now
                WHERE id = :id
            """),
            {"id": work_order_id, "now": now_str}
        )

        await db.execute(
            text("""
                INSERT INTO work_order_status_history
                (id, work_order_id, from_status, to_status, changed_by, changed_at, notes)
                VALUES
                (:id, :wo_id, :from_st, 'in_progress', :by, :now, 'Field worker started task on site.')
            """),
            {
                "id": f"WOSH-{uuid.uuid4().hex[:8].upper()}",
                "wo_id": work_order_id,
                "from_st": wo["status"],
                "by": worker_name,
                "now": now_str,
            }
        )

        await db.execute(
            text("""
                INSERT INTO location_activities
                (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
                VALUES
                (:id, :loc_id, :issue_id, 'work_order_started', :by, :now, :notes, :now)
            """),
            {
                "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
                "loc_id": wo["location_id"],
                "issue_id": wo.get("issue_id"),
                "by": worker_name,
                "now": now_str,
                "notes": f"Field worker {worker_name} started service work order #{work_order_id}."
            }
        )
        await db.commit()
        return await cls.get_work_order_detail(db, work_order_id)

    @classmethod
    async def submit_evidence(
        cls,
        db: AsyncSession,
        work_order_id: str,
        submission_data: Dict[str, Any],
        files: List[Dict[str, Any]],
        worker_name: str
    ) -> Dict[str, Any]:
        """
        Record worker service completion and attach evidence files.
        Performs cryptographic SHA256 duplicate image detection across all uploaded files.
        """
        wo = await cls.get_work_order_detail(db, work_order_id)
        if not wo:
            raise ValueError("Work order not found.")
        if wo["status"] not in ("in_progress", "assigned", "clarification_required"):
            raise ValueError(f"Cannot submit evidence for work order in '{wo['status']}' status.")

        now_str = _now_iso()
        sub_id = f"SUB-{uuid.uuid4().hex[:8].upper()}"

        # Determine submission version
        prev_sub_count = (
            await db.execute(
                text("SELECT count(*) FROM service_evidence_submissions WHERE work_order_id = :wo_id"),
                {"wo_id": work_order_id}
            )
        ).scalar() or 0
        version = prev_sub_count + 1

        # Insert submission record
        await db.execute(
            text("""
                INSERT INTO service_evidence_submissions
                (id, work_order_id, submission_version, submitted_by, action_type,
                 work_description, materials_used, unresolved_notes, access_restricted,
                 submitted_at, supervisor_decision, decision_notes, decided_by, decided_at)
                VALUES
                (:id, :wo_id, :version, :by, :action_type,
                 :work_description, :materials_used, :unresolved_notes, :access_restricted,
                 :now, 'pending', NULL, NULL, NULL)
            """),
            {
                "id": sub_id,
                "wo_id": work_order_id,
                "version": version,
                "by": worker_name,
                "action_type": submission_data["action_type"],
                "work_description": submission_data["work_description"].strip(),
                "materials_used": submission_data.get("materials_used"),
                "unresolved_notes": submission_data.get("unresolved_notes"),
                "access_restricted": 1 if submission_data.get("access_restricted") else 0,
                "now": now_str,
            }
        )

        # Process and attach files
        for f in files:
            file_id = f"FILE-{uuid.uuid4().hex[:8].upper()}"
            sha256_hash = f["sha256"]

            # Check duplicate hash detection across existing evidence
            dup_res = await db.execute(
                text("""
                    SELECT id, work_order_id
                    FROM service_evidence_files
                    WHERE file_sha256 = :h
                    LIMIT 1
                """),
                {"h": sha256_hash}
            )
            dup_row = dup_res.mappings().first()
            is_dup = 1 if dup_row else 0
            ref_dup_id = dup_row["id"] if dup_row else None

            await db.execute(
                text("""
                    INSERT INTO service_evidence_files
                    (id, submission_id, work_order_id, evidence_category, file_path,
                     original_filename, file_size_bytes, mime_type, file_sha256,
                     is_duplicate_flag, duplicate_reference_file_id, client_captured_at,
                     server_received_at, description)
                    VALUES
                    (:id, :sub_id, :wo_id, :cat, :path,
                     :orig_name, :size, :mime, :sha256,
                     :is_dup, :ref_dup_id, :captured_at,
                     :now, :desc)
                """),
                {
                    "id": file_id,
                    "sub_id": sub_id,
                    "wo_id": work_order_id,
                    "cat": f.get("category", "after_photo"),
                    "path": f["path"],
                    "orig_name": f["filename"],
                    "size": f["size"],
                    "mime": f["mime"],
                    "sha256": sha256_hash,
                    "is_dup": is_dup,
                    "ref_dup_id": ref_dup_id,
                    "captured_at": f.get("client_captured_at"),
                    "now": now_str,
                    "desc": f.get("description"),
                }
            )

        # Update work order
        await db.execute(
            text("""
                UPDATE service_work_orders
                SET status = 'evidence_submitted',
                    action_performed = :act_type,
                    action_summary = :desc,
                    materials_used = :mats,
                    labor_hours = CASE WHEN :labor IS NOT NULL THEN :labor ELSE labor_hours END,
                    actual_cost = CASE WHEN :cost IS NOT NULL THEN :cost ELSE actual_cost END,
                    completed_at = :now,
                    updated_at = :now
                WHERE id = :id
            """),
            {
                "id": work_order_id,
                "act_type": submission_data["action_type"],
                "desc": submission_data["work_description"].strip(),
                "mats": submission_data.get("materials_used"),
                "labor": submission_data.get("labor_hours"),
                "cost": submission_data.get("actual_cost"),
                "now": now_str,
            }
        )

        # Status history
        await db.execute(
            text("""
                INSERT INTO work_order_status_history
                (id, work_order_id, from_status, to_status, changed_by, changed_at, notes)
                VALUES
                (:id, :wo_id, :from_st, 'evidence_submitted', :by, :now, :notes)
            """),
            {
                "id": f"WOSH-{uuid.uuid4().hex[:8].upper()}",
                "wo_id": work_order_id,
                "from_st": wo["status"],
                "by": worker_name,
                "now": now_str,
                "notes": f"Evidence submitted (v{version}) with {len(files)} file attachment(s)."
            }
        )

        # Location timeline entry
        await db.execute(
            text("""
                INSERT INTO location_activities
                (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
                VALUES
                (:id, :loc_id, :issue_id, 'evidence_submitted', :by, :now, :notes, :now)
            """),
            {
                "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
                "loc_id": wo["location_id"],
                "issue_id": wo.get("issue_id"),
                "by": worker_name,
                "now": now_str,
                "notes": f"Service evidence submitted for #{work_order_id}: {submission_data['action_type']} ({len(files)} photo/evidence attachments)."
            }
        )
        await db.commit()
        return await cls.get_work_order_detail(db, work_order_id)

    @classmethod
    async def review_evidence(
        cls,
        db: AsyncSession,
        work_order_id: str,
        decision: str,
        decision_notes: str,
        supervisor_name: str
    ) -> Dict[str, Any]:
        """
        Supervisor evidence review:
        - 'accepted' -> 'work_verified' (service completed verified, resolution remains awaiting follow-up).
        - 'clarification_required' -> worker must provide additional details/evidence.
        - 'rejected' -> evidence inadequate.
        """
        wo = await cls.get_work_order_detail(db, work_order_id)
        if not wo:
            raise ValueError("Work order not found.")
        if wo["status"] != "evidence_submitted":
            raise ValueError(f"Cannot review work order in status '{wo['status']}'. Must be 'evidence_submitted'.")

        now_str = _now_iso()

        # Update latest submission
        await db.execute(
            text("""
                UPDATE service_evidence_submissions
                SET supervisor_decision = :decision,
                    decision_notes = :notes,
                    decided_by = :by,
                    decided_at = :now
                WHERE work_order_id = :wo_id
                  AND submission_version = (
                      SELECT MAX(submission_version)
                      FROM service_evidence_submissions
                      WHERE work_order_id = :wo_id
                  )
            """),
            {
                "decision": decision,
                "notes": decision_notes.strip(),
                "by": supervisor_name,
                "now": now_str,
                "wo_id": work_order_id,
            }
        )

        new_status = "work_verified" if decision == "accepted" else "clarification_required"
        verified_at = now_str if decision == "accepted" else None

        await db.execute(
            text("""
                UPDATE service_work_orders
                SET status = :st,
                    verified_at = CASE WHEN :ver_at IS NOT NULL THEN :ver_at ELSE verified_at END,
                    resolution_verification_status = CASE
                        WHEN :st = 'work_verified' AND resolution_verification_status = 'not_required' THEN 'not_required'
                        WHEN :st = 'work_verified' THEN 'awaiting_followup'
                        ELSE resolution_verification_status
                    END,
                    updated_at = :now
                WHERE id = :id
            """),
            {
                "st": new_status,
                "ver_at": verified_at,
                "now": now_str,
                "id": work_order_id,
            }
        )

        # Audit history
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
                "to_st": new_status,
                "by": supervisor_name,
                "now": now_str,
                "notes": f"Supervisor review: {decision.upper()}. Notes: {decision_notes.strip()}"
            }
        )

        # Location timeline entry
        act_type = "work_verified" if decision == "accepted" else "clarification_requested"
        act_note = (
            f"Service work verified by supervisor {supervisor_name}."
            if decision == "accepted"
            else f"Supervisor {supervisor_name} requested clarification: {decision_notes.strip()}"
        )
        await db.execute(
            text("""
                INSERT INTO location_activities
                (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
                VALUES
                (:id, :loc_id, :issue_id, :act_type, :by, :now, :notes, :now)
            """),
            {
                "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
                "loc_id": wo["location_id"],
                "issue_id": wo.get("issue_id"),
                "act_type": act_type,
                "by": supervisor_name,
                "now": now_str,
                "notes": f"Work order #{work_order_id}: {act_note}"
            }
        )

        await db.commit()

        # Connect with Smart Reinspection Scheduling (Improvement 02)
        if decision == "accepted":
            try:
                from services.reinspection_scheduler import ReinspectionScheduler
                await ReinspectionScheduler.evaluate_location(db, wo["location_id"])
            except Exception as sch_err:
                print(f"Post-verification scheduling notice: {sch_err}")

        return await cls.get_work_order_detail(db, work_order_id)

    @classmethod
    async def record_followup_resolution(
        cls,
        db: AsyncSession,
        work_order_id: str,
        verified_outcome: str,
        verification_notes: str,
        inspector_name: str,
        evidence_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Record independent on-site follow-up observation:
        - 'clear' -> Resolution confirmed at follow-up (sets issue to 'resolved').
        - 'problem_still_present' -> Interventions failed; issue remains open.
        - 'unable_to_inspect' -> Inconclusive check.
        """
        wo = await cls.get_work_order_detail(db, work_order_id)
        if not wo:
            raise ValueError("Work order not found.")
        if wo["status"] != "work_verified":
            raise ValueError(f"Follow-up resolution requires verified work order (currently '{wo['status']}').")

        now_str = _now_iso()
        res_id = f"RES-{uuid.uuid4().hex[:8].upper()}"
        insp_id = f"INSP-{uuid.uuid4().hex[:8].upper()}"

        # 1. Record physical inspection in location_inspections
        insp_result = "clear" if verified_outcome == "clear" else ("problem_found" if verified_outcome == "problem_still_present" else "unable_to_inspect")
        await db.execute(
            text("""
                INSERT INTO location_inspections
                (id, location_id, inspector_name, inspector_role, inspection_date,
                 result, notes, evidence_notes, problem_identified, created_at)
                VALUES
                (:id, :loc_id, :by, 'Quality Assurance Inspector', :now,
                 :result, :notes, :ev_notes, :prob, :now)
            """),
            {
                "id": insp_id,
                "loc_id": wo["location_id"],
                "by": inspector_name,
                "now": now_str,
                "result": insp_result,
                "notes": f"Follow-up verification visit for work order #{work_order_id}: {verification_notes.strip()}",
                "ev_notes": evidence_notes,
                "prob": "Hazard remained present upon follow-up inspection" if verified_outcome == "problem_still_present" else None,
            }
        )

        # 2. Update issue status and resolution status
        if verified_outcome == "clear":
            new_res_status = "resolution_confirmed"
            issue_after = "resolved"
            if wo.get("issue_id"):
                await db.execute(
                    text("""
                        UPDATE location_issues
                        SET status = 'resolved',
                            resolved_at = :now,
                            resolved_by = :by,
                            resolution_notes = :notes,
                            updated_at = :now
                        WHERE id = :id
                    """),
                    {
                        "now": now_str,
                        "by": inspector_name,
                        "notes": f"Resolution confirmed at follow-up: {verification_notes.strip()}",
                        "id": wo["issue_id"],
                    }
                )
        elif verified_outcome == "problem_still_present":
            new_res_status = "followup_failed_issue_present"
            issue_after = "open"
        else:
            new_res_status = "followup_inconclusive"
            issue_after = wo.get("issue_status") or "open"

        # Update work order resolution verification status
        await db.execute(
            text("""
                UPDATE service_work_orders
                SET resolution_verification_status = :res_status,
                    updated_at = :now
                WHERE id = :id
            """),
            {"res_status": new_res_status, "now": now_str, "id": work_order_id}
        )

        # 3. Insert resolution verification record
        await db.execute(
            text("""
                INSERT INTO resolution_verification_records
                (id, work_order_id, issue_id, location_id, followup_inspection_id,
                 verified_outcome, verified_by, verified_at, verification_notes,
                 issue_status_after, created_at)
                VALUES
                (:id, :wo_id, :issue_id, :loc_id, :insp_id,
                 :outcome, :by, :now, :notes,
                 :after_st, :now)
            """),
            {
                "id": res_id,
                "wo_id": work_order_id,
                "issue_id": wo.get("issue_id"),
                "loc_id": wo["location_id"],
                "insp_id": insp_id,
                "outcome": verified_outcome,
                "by": inspector_name,
                "now": now_str,
                "notes": verification_notes.strip(),
                "after_st": issue_after,
            }
        )

        # 4. Location timeline activity
        act_text = (
            f"Resolution confirmed at follow-up inspection #{insp_id}: {verification_notes.strip()}"
            if verified_outcome == "clear"
            else f"Follow-up inspection detected problem STILL PRESENT. Work order #{work_order_id} failed resolution."
        )
        await db.execute(
            text("""
                INSERT INTO location_activities
                (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
                VALUES
                (:id, :loc_id, :issue_id, :act_type, :by, :now, :notes, :now)
            """),
            {
                "id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
                "loc_id": wo["location_id"],
                "issue_id": wo.get("issue_id"),
                "act_type": "resolution_confirmed" if verified_outcome == "clear" else "followup_failed",
                "by": inspector_name,
                "now": now_str,
                "notes": act_text,
            }
        )
        await db.commit()

        return await cls.get_work_order_detail(db, work_order_id)

    @classmethod
    async def get_work_order_detail(
        cls,
        db: AsyncSession,
        work_order_id: str
    ) -> Optional[Dict[str, Any]]:
        """Retrieve complete work order profile with submissions, files, and resolution records."""
        query = text("""
            SELECT wo.*,
                   p.name AS property_name, p.ward_id,
                   l.location_code, l.name AS location_name, l.category AS location_category,
                   i.issue_type, i.severity AS issue_severity, i.status AS issue_status
            FROM service_work_orders wo
            JOIN properties p ON wo.property_id = p.id
            JOIN permanent_hazard_locations l ON wo.location_id = l.id
            LEFT JOIN location_issues i ON wo.issue_id = i.id
            WHERE wo.id = :id
        """)
        res = await db.execute(query, {"id": work_order_id})
        row = res.mappings().first()
        if not row:
            return None

        data = dict(row)
        today = _today_str()
        data["is_overdue"] = bool(
            data["status"] not in ("work_verified", "cancelled") and data["due_date"] < today
        )

        # Fetch submissions
        subs_res = await db.execute(
            text("""
                SELECT * FROM service_evidence_submissions
                WHERE work_order_id = :id
                ORDER BY submission_version DESC
            """),
            {"id": work_order_id}
        )
        subs = [dict(s) for s in subs_res.mappings().all()]

        # Attach files to each submission
        for sub in subs:
            f_res = await db.execute(
                text("SELECT * FROM service_evidence_files WHERE submission_id = :sid ORDER BY server_received_at ASC"),
                {"sid": sub["id"]}
            )
            sub_files = []
            for f in f_res.mappings().all():
                fd = dict(f)
                fd["is_duplicate_flag"] = bool(fd.get("is_duplicate_flag"))
                fd["download_url"] = f"/api/services/evidence/file/{fd['id']}"
                sub_files.append(fd)
            sub["files"] = sub_files
            sub["access_restricted"] = bool(sub.get("access_restricted"))
        data["submissions"] = subs

        # Fetch status history
        hist_res = await db.execute(
            text("SELECT * FROM work_order_status_history WHERE work_order_id = :id ORDER BY changed_at ASC"),
            {"id": work_order_id}
        )
        data["status_history"] = [dict(h) for h in hist_res.mappings().all()]

        # Fetch resolution records
        res_rec = await db.execute(
            text("SELECT * FROM resolution_verification_records WHERE work_order_id = :id ORDER BY verified_at DESC"),
            {"id": work_order_id}
        )
        data["resolution_records"] = [dict(r) for r in res_rec.mappings().all()]

        return data

    @classmethod
    async def get_service_statistics(cls, db: AsyncSession) -> Dict[str, Any]:
        """Compute operational statistics based on real service work order records."""
        total = (await db.execute(text("SELECT count(*) FROM service_work_orders"))).scalar() or 0
        assigned = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE status = 'assigned'"))).scalar() or 0
        in_prog = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE status = 'in_progress'"))).scalar() or 0
        ev_sub = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE status = 'evidence_submitted'"))).scalar() or 0
        clar_req = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE status = 'clarification_required'"))).scalar() or 0
        verified = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE status = 'work_verified'"))).scalar() or 0
        cancelled = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE status = 'cancelled'"))).scalar() or 0

        awaiting_fol = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE resolution_verification_status = 'awaiting_followup'"))).scalar() or 0
        fol_sched = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE resolution_verification_status = 'followup_scheduled'"))).scalar() or 0
        res_conf = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE resolution_verification_status = 'resolution_confirmed'"))).scalar() or 0
        fol_failed = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE resolution_verification_status = 'followup_failed_issue_present'"))).scalar() or 0
        reopened = (await db.execute(text("SELECT count(*) FROM service_work_orders WHERE resolution_verification_status = 'issue_reopened'"))).scalar() or 0

        total_files = (await db.execute(text("SELECT count(*) FROM service_evidence_files"))).scalar() or 0
        dup_flags = (await db.execute(text("SELECT count(*) FROM service_evidence_files WHERE is_duplicate_flag = 1"))).scalar() or 0

        # Contractor performance aggregation
        perf_query = text("""
            SELECT assigned_contractor,
                   count(*) AS total_tasks,
                   count(CASE WHEN status IN ('evidence_submitted', 'work_verified') THEN 1 END) AS completed_tasks,
                   count(CASE WHEN status = 'work_verified' THEN 1 END) AS verified_tasks,
                   count(CASE WHEN status = 'clarification_required' THEN 1 END) AS clarification_tasks
            FROM service_work_orders
            WHERE assigned_contractor IS NOT NULL AND assigned_contractor != ''
            GROUP BY assigned_contractor
        """)
        perf_res = await db.execute(perf_query)
        contractors = []
        for row in perf_res.mappings().all():
            tot = row["total_tasks"]
            comp = row["completed_tasks"]
            ver = row["verified_tasks"]
            clar = row["clarification_tasks"]
            clar_rate = round((clar / tot * 100.0), 1) if tot > 0 else 0.0
            on_time = round((ver / tot * 100.0), 1) if tot > 0 else 0.0
            contractors.append({
                "contractor_name": row["assigned_contractor"],
                "assigned_tasks_count": tot,
                "completed_tasks_count": comp,
                "verified_tasks_count": ver,
                "clarification_rate_pct": clar_rate,
                "on_time_completion_pct": on_time,
                "repeat_issues_on_sites": 0,
            })

        return {
            "total_work_orders": total,
            "assigned_count": assigned,
            "in_progress_count": in_prog,
            "evidence_submitted_count": ev_sub,
            "clarification_required_count": clar_req,
            "work_verified_count": verified,
            "cancelled_count": cancelled,
            "awaiting_followup_count": awaiting_fol,
            "followup_scheduled_count": fol_sched,
            "resolution_confirmed_count": res_conf,
            "followup_failed_count": fol_failed,
            "reopened_issues_count": reopened,
            "total_evidence_files": total_files,
            "duplicate_evidence_flags": dup_flags,
            "contractor_performance": contractors,
        }
