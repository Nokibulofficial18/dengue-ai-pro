"""
Pydantic schemas for Improvement 03 — Service and Resolution Verification.
Defines models for property-level service work orders, evidence submissions,
duplicate-detection file metadata, supervisor reviews, and follow-up
resolution verification.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# SERVICE WORK ORDERS
# ============================================================================
class WorkOrderCreate(BaseModel):
    property_id: str
    location_id: str
    issue_id: Optional[str] = None
    recommendation_id: Optional[str] = None
    scheduled_inspection_id: Optional[str] = None
    title: str = Field(..., min_length=3, max_length=150)
    description: Optional[str] = None
    required_action: str = Field(
        ...,
        description="'clean_drain', 'remove_standing_water', 'apply_larvicide', 'repair_component', 'cover_container', 'waste_removal', 'other'"
    )
    priority: str = Field("medium", description="'low', 'medium', 'high', 'critical'")
    assigned_worker_id: Optional[str] = None
    assigned_worker_name: str = Field(..., min_length=2)
    assigned_contractor: Optional[str] = None
    responsible_supervisor: str = Field(..., min_length=2)
    due_date: str = Field(..., description="Target completion deadline (YYYY-MM-DD)")
    # Extensible fields for future Improvement 04 cost analysis
    labor_hours: Optional[float] = Field(0.0, ge=0.0)
    actual_cost: Optional[float] = Field(0.0, ge=0.0)
    currency: Optional[str] = Field("BDT")
    repair_classification: Optional[str] = Field("temporary_mitigation")


class WorkOrderStatusUpdate(BaseModel):
    to_status: str = Field(..., description="'in_progress', 'cancelled'")
    notes: Optional[str] = None


# ============================================================================
# EVIDENCE SUBMISSIONS & FILES
# ============================================================================
class EvidenceFileOut(BaseModel):
    id: str
    submission_id: str
    work_order_id: str
    evidence_category: str
    file_path: str
    download_url: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    file_sha256: str
    is_duplicate_flag: bool
    duplicate_reference_file_id: Optional[str] = None
    client_captured_at: Optional[str] = None
    server_received_at: str
    description: Optional[str] = None


class EvidenceSubmissionCreate(BaseModel):
    action_type: str = Field(
        ...,
        description="'cleaned', 'drained', 'covered', 'repaired', 'larvicide_applied', 'unable_to_access', 'other'"
    )
    work_description: str = Field(..., min_length=5)
    materials_used: Optional[str] = None
    unresolved_notes: Optional[str] = None
    access_restricted: bool = False
    labor_hours: Optional[float] = Field(None, ge=0.0)
    actual_cost: Optional[float] = Field(None, ge=0.0)


class EvidenceSubmissionOut(BaseModel):
    id: str
    work_order_id: str
    submission_version: int
    submitted_by: str
    action_type: str
    work_description: str
    materials_used: Optional[str]
    unresolved_notes: Optional[str]
    access_restricted: bool
    submitted_at: str
    supervisor_decision: str = Field("pending", description="'pending', 'accepted', 'clarification_required', 'rejected'")
    decision_notes: Optional[str] = None
    decided_by: Optional[str] = None
    decided_at: Optional[str] = None
    files: List[EvidenceFileOut] = []


class SupervisorReviewRequest(BaseModel):
    decision: str = Field(..., description="'accepted', 'clarification_required', or 'rejected'")
    decision_notes: str = Field(..., min_length=3, description="Explanation for supervisor decision (mandatory)")


# ============================================================================
# RESOLUTION VERIFICATION & FOLLOW-UP
# ============================================================================
class FollowupResolutionRequest(BaseModel):
    verified_outcome: str = Field(
        ...,
        description="'clear', 'problem_still_present', 'unable_to_inspect'"
    )
    verification_notes: str = Field(..., min_length=5, description="Follow-up inspector observation notes")
    inspector_name: Optional[str] = None
    evidence_notes: Optional[str] = None


class ResolutionRecordOut(BaseModel):
    id: str
    work_order_id: str
    issue_id: Optional[str]
    location_id: str
    followup_inspection_id: Optional[str]
    followup_scheduled_id: Optional[str]
    verified_outcome: str
    verified_by: str
    verified_at: str
    verification_notes: str
    issue_status_after: str
    created_at: str


class WorkOrderStatusHistoryOut(BaseModel):
    id: str
    work_order_id: str
    from_status: Optional[str]
    to_status: str
    changed_by: str
    changed_at: str
    notes: Optional[str]


# ============================================================================
# FULL WORK ORDER DETAILS & LISTING
# ============================================================================
class WorkOrderOut(BaseModel):
    id: str
    property_id: str
    property_name: Optional[str] = None
    location_id: str
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    location_category: Optional[str] = None
    ward_id: Optional[str] = None
    issue_id: Optional[str] = None
    issue_type: Optional[str] = None
    issue_severity: Optional[str] = None
    issue_status: Optional[str] = None
    recommendation_id: Optional[str] = None
    scheduled_inspection_id: Optional[str] = None
    title: str
    description: Optional[str]
    required_action: str
    priority: str
    assigned_worker_id: Optional[str]
    assigned_worker_name: str
    assigned_contractor: Optional[str]
    responsible_supervisor: str
    due_date: str
    status: str = Field(..., description="'assigned', 'in_progress', 'evidence_submitted', 'clarification_required', 'work_verified', 'cancelled'")
    resolution_verification_status: str = Field(
        ...,
        description="'not_required', 'awaiting_followup', 'followup_scheduled', 'resolution_confirmed', 'followup_failed_issue_present', 'issue_reopened', 'followup_inconclusive'"
    )
    action_performed: Optional[str] = None
    action_summary: Optional[str] = None
    materials_used: Optional[str] = None
    labor_hours: float = 0.0
    actual_cost: float = 0.0
    currency: str = "BDT"
    repair_classification: str = "temporary_mitigation"
    is_overdue: bool = False
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    verified_at: Optional[str] = None
    created_at: str
    updated_at: str
    submissions: List[EvidenceSubmissionOut] = []
    status_history: List[WorkOrderStatusHistoryOut] = []
    resolution_records: List[ResolutionRecordOut] = []


# ============================================================================
# OPERATIONAL METRICS & CONTRACTOR PERFORMANCE
# ============================================================================
class ContractorPerformanceOut(BaseModel):
    contractor_name: str
    assigned_tasks_count: int
    completed_tasks_count: int
    verified_tasks_count: int
    clarification_rate_pct: float
    on_time_completion_pct: float
    repeat_issues_on_sites: int


class ServiceStatsOut(BaseModel):
    total_work_orders: int
    assigned_count: int
    in_progress_count: int
    evidence_submitted_count: int
    clarification_required_count: int
    work_verified_count: int
    cancelled_count: int
    awaiting_followup_count: int
    followup_scheduled_count: int
    resolution_confirmed_count: int
    followup_failed_count: int
    reopened_issues_count: int
    total_evidence_files: int
    duplicate_evidence_flags: int
    contractor_performance: List[ContractorPerformanceOut] = []
