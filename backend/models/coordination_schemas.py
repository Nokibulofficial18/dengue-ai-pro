"""
Pydantic schemas for Improvement 05: Coordinated Prevention Across Properties.
Supports organizations, coordination groups, memberships, invitations,
shared areas, responsibility handoffs, data-sharing permissions,
consortium meetings, action items, audit logs, and operational reports.
"""
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


# ------------------------------------------------------------------------------
# Organization Schemas
# ------------------------------------------------------------------------------

class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    org_type: str = Field(..., description="industrial_park_operator, factory_company, contractor, property_management, university, hospital")
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    authorized_representative: str = Field(..., min_length=2, max_length=100)
    representative_role: Optional[str] = None
    address: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    id: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    authorized_representative: Optional[str] = None
    representative_role: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None


class OrganizationResponse(OrganizationBase):
    id: str
    status: str
    created_at: str
    updated_at: str
    properties_count: Optional[int] = 0
    memberships_count: Optional[int] = 0


# ------------------------------------------------------------------------------
# Coordination Group Schemas
# ------------------------------------------------------------------------------

class CoordinationGroupBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    group_type: str = Field(..., description="industrial_park, university_campus, residential_complex, hospital_network, commercial_complex")
    description: Optional[str] = None
    geographic_scope: Optional[str] = None
    boundary_geojson: Optional[str] = None
    coordinator_name: str = Field(..., min_length=2, max_length=100)
    coordinator_contact: Optional[str] = None
    participation_rules: Optional[str] = None


class CoordinationGroupCreate(CoordinationGroupBase):
    id: Optional[str] = None
    managing_org_id: str


class CoordinationGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    geographic_scope: Optional[str] = None
    boundary_geojson: Optional[str] = None
    coordinator_name: Optional[str] = None
    coordinator_contact: Optional[str] = None
    participation_rules: Optional[str] = None
    status: Optional[str] = None


class CoordinationGroupResponse(CoordinationGroupBase):
    id: str
    managing_org_id: str
    managing_org_name: Optional[str] = None
    status: str
    created_at: str
    updated_at: str
    member_count: Optional[int] = 0
    shared_areas_count: Optional[int] = 0


# ------------------------------------------------------------------------------
# Group Membership Schemas
# ------------------------------------------------------------------------------

class GroupMembershipCreate(BaseModel):
    group_id: str
    organization_id: str
    role: str = "participating_member"  # managing_lead, participating_member, shared_contractor, monitoring_agency
    authorized_by: str
    notes: Optional[str] = None


class MembershipWithdrawRequest(BaseModel):
    withdrawal_reason: str = Field(..., min_length=5, max_length=500)
    authorized_by: str = Field(..., min_length=2, max_length=100)


class GroupMembershipResponse(BaseModel):
    id: str
    group_id: str
    group_name: Optional[str] = None
    organization_id: str
    organization_name: Optional[str] = None
    org_type: Optional[str] = None
    role: str
    status: str
    joined_at: str
    withdrawn_at: Optional[str] = None
    withdrawal_reason: Optional[str] = None
    authorized_by: str
    notes: Optional[str] = None
    created_at: str


# ------------------------------------------------------------------------------
# Group Invitation Schemas
# ------------------------------------------------------------------------------

class GroupInvitationCreate(BaseModel):
    group_id: str
    invited_org_id: str
    inviting_org_id: str
    invited_by_name: str
    message: Optional[str] = None
    expires_in_days: int = 30


class InvitationDecisionRequest(BaseModel):
    decision: str = Field(..., description="accept or decline")
    decision_by_name: str = Field(..., min_length=2, max_length=100)
    decision_notes: Optional[str] = None


class GroupInvitationResponse(BaseModel):
    id: str
    group_id: str
    group_name: Optional[str] = None
    invited_org_id: str
    invited_org_name: Optional[str] = None
    inviting_org_id: str
    inviting_org_name: Optional[str] = None
    invited_by_name: str
    invitation_token: str
    message: Optional[str] = None
    status: str
    invited_at: str
    expires_at: str
    decided_at: Optional[str] = None
    decision_by_name: Optional[str] = None
    decision_notes: Optional[str] = None


# ------------------------------------------------------------------------------
# Shared Area Schemas
# ------------------------------------------------------------------------------

class SharedAreaBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=150)
    area_type: str = Field(..., description="drainage_corridor, service_road, waste_storage, courtyard, retention_pond, utility_facility")
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    boundary_geojson: Optional[str] = None
    responsible_org_id: Optional[str] = None
    responsible_manager: Optional[str] = None
    linked_location_id: Optional[str] = None
    visibility_classification: str = "consortium_shared"


class SharedAreaCreate(SharedAreaBase):
    id: Optional[str] = None
    group_id: str


class SharedAreaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    boundary_geojson: Optional[str] = None
    responsible_org_id: Optional[str] = None
    responsible_manager: Optional[str] = None
    linked_location_id: Optional[str] = None
    visibility_classification: Optional[str] = None
    status: Optional[str] = None


class SharedAreaResponse(SharedAreaBase):
    id: str
    group_id: str
    group_name: Optional[str] = None
    responsible_org_name: Optional[str] = "Responsibility not assigned"
    linked_location_name: Optional[str] = None
    status: str
    created_at: str
    updated_at: str
    open_tasks_count: Optional[int] = 0
    upcoming_inspections_count: Optional[int] = 0


# ------------------------------------------------------------------------------
# Responsibility Handoff Schemas
# ------------------------------------------------------------------------------

class ResponsibilityHandoffCreate(BaseModel):
    group_id: str
    shared_area_id: Optional[str] = None
    work_order_id: Optional[str] = None
    issue_id: Optional[str] = None
    originating_org_id: str
    proposed_receiving_org_id: str
    reason: str = Field(..., min_length=10, max_length=1000)
    boundary_evidence_summary: Optional[str] = None
    requested_by_name: str = Field(..., min_length=2, max_length=100)


class ResponsibilityHandoffReviewRequest(BaseModel):
    decision: str = Field(..., description="accept, reject, clarification_requested")
    reviewed_by_name: str = Field(..., min_length=2, max_length=100)
    review_decision_notes: str = Field(..., min_length=5, max_length=1000)


class ResponsibilityHandoffResponse(BaseModel):
    id: str
    group_id: str
    group_name: Optional[str] = None
    shared_area_id: Optional[str] = None
    shared_area_name: Optional[str] = None
    work_order_id: Optional[str] = None
    issue_id: Optional[str] = None
    originating_org_id: str
    originating_org_name: Optional[str] = None
    proposed_receiving_org_id: str
    proposed_receiving_org_name: Optional[str] = None
    reason: str
    boundary_evidence_summary: Optional[str] = None
    status: str
    requested_by_name: str
    requested_at: str
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_decision_notes: Optional[str] = None
    created_at: str


# ------------------------------------------------------------------------------
# Data Sharing Permission Schemas
# ------------------------------------------------------------------------------

class DataSharingPermissionCreate(BaseModel):
    group_id: str
    source_org_id: str
    receiving_org_id: Optional[str] = None  # None = entire group
    information_category: str = Field(..., description="shared_area_status, reinspection_schedule, boundary_hazard_alert, service_verification_summary")
    permitted_access_level: str = Field(..., description="summary_only, operational_status, detailed_dates")
    sharing_purpose: str = Field(..., min_length=5, max_length=500)
    granted_by_name: str = Field(..., min_length=2, max_length=100)
    expires_at: Optional[str] = None


class DataSharingPermissionRevokeRequest(BaseModel):
    revoked_by_name: str = Field(..., min_length=2, max_length=100)
    revocation_reason: str = Field(..., min_length=5, max_length=500)


class DataSharingPermissionResponse(BaseModel):
    id: str
    group_id: str
    group_name: Optional[str] = None
    source_org_id: str
    source_org_name: Optional[str] = None
    receiving_org_id: Optional[str] = None
    receiving_org_name: Optional[str] = "All Consortium Members"
    information_category: str
    permitted_access_level: str
    sharing_purpose: str
    is_revoked: int
    granted_by_name: str
    granted_at: str
    expires_at: Optional[str] = None
    revoked_by_name: Optional[str] = None
    revoked_at: Optional[str] = None
    revocation_reason: Optional[str] = None


# ------------------------------------------------------------------------------
# Meeting & Action Item Schemas
# ------------------------------------------------------------------------------

class CoordinationMeetingCreate(BaseModel):
    group_id: str
    meeting_title: str = Field(..., min_length=5, max_length=200)
    meeting_date: str
    chairperson_name: str = Field(..., min_length=2, max_length=100)
    chairperson_org_id: str
    attendees: List[Dict[str, Any]] = []
    discussion_summary: str = Field(..., min_length=10)
    next_meeting_date: Optional[str] = None


class CoordinationMeetingResponse(BaseModel):
    id: str
    group_id: str
    meeting_title: str
    meeting_date: str
    chairperson_name: str
    chairperson_org_id: str
    chairperson_org_name: Optional[str] = None
    attendees: List[Dict[str, Any]] = []
    discussion_summary: str
    next_meeting_date: Optional[str] = None
    created_at: str
    action_items_count: Optional[int] = 0


class CoordinationActionItemCreate(BaseModel):
    meeting_id: Optional[str] = None
    group_id: str
    action_title: str = Field(..., min_length=5, max_length=200)
    description: Optional[str] = None
    assigned_org_id: str
    assigned_lead_name: Optional[str] = None
    due_date: str
    linked_shared_area_id: Optional[str] = None
    linked_work_order_id: Optional[str] = None


class CoordinationActionItemUpdate(BaseModel):
    action_title: Optional[str] = None
    description: Optional[str] = None
    assigned_org_id: Optional[str] = None
    assigned_lead_name: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None  # pending, in_progress, completed, overdue
    completion_notes: Optional[str] = None


class CoordinationActionItemResponse(BaseModel):
    id: str
    meeting_id: Optional[str] = None
    group_id: str
    action_title: str
    description: Optional[str] = None
    assigned_org_id: str
    assigned_org_name: Optional[str] = None
    assigned_lead_name: Optional[str] = None
    due_date: str
    status: str
    linked_shared_area_id: Optional[str] = None
    linked_shared_area_name: Optional[str] = None
    linked_work_order_id: Optional[str] = None
    completion_notes: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str


# ------------------------------------------------------------------------------
# Audit Log Schemas
# ------------------------------------------------------------------------------

class CoordinationAuditLogResponse(BaseModel):
    id: str
    group_id: Optional[str] = None
    actor_name: str
    actor_org_id: Optional[str] = None
    actor_org_name: Optional[str] = None
    action_type: str
    target_entity_type: str
    target_entity_id: str
    details: Optional[Dict[str, Any]] = None
    timestamp: str


# ------------------------------------------------------------------------------
# Summary & Report Schemas
# ------------------------------------------------------------------------------

class GroupSummaryMetrics(BaseModel):
    group_id: str
    group_name: str
    total_participating_orgs: int
    total_shared_areas: int
    shared_areas_with_assigned_owner: int
    percentage_shared_areas_assigned: float
    upcoming_shared_inspections_count: int
    open_shared_work_orders_count: int
    overdue_shared_tasks_count: int
    verified_shared_services_count: int
    pending_handoffs_count: int
    unassigned_shared_areas_count: int


class GroupCoordinationReport(BaseModel):
    group_id: str
    group_name: str
    managing_org_name: str
    reporting_period: str
    participating_orgs: List[Dict[str, Any]]
    shared_areas_summary: List[Dict[str, Any]]
    inspections_completed_count: int
    inspections_overdue_count: int
    shared_tasks_completed_count: int
    outstanding_shared_issues_count: int
    pending_responsibility_handoffs_count: int
    upcoming_activities: List[Dict[str, Any]]
    agreed_action_items: List[CoordinationActionItemResponse]
    metrics: GroupSummaryMetrics
    generated_at: str
    generated_by: str


# ------------------------------------------------------------------------------
# Operational Execution Schemas (Shared Inspections & Work Orders)
# ------------------------------------------------------------------------------

class SharedInspectionCreate(BaseModel):
    shared_area_id: str
    scheduled_date: str
    assigned_inspector: str = Field(..., min_length=2, max_length=100)
    visit_type: str = "shared_consortium"
    notes: Optional[str] = None
    created_by: str = Field(..., min_length=2, max_length=100)


class SharedWorkOrderCreate(BaseModel):
    shared_area_id: str
    title: str = Field(..., min_length=3, max_length=200)
    required_action: str = Field(..., min_length=5, max_length=1000)
    priority: str = "medium"  # low, medium, high, critical
    assigned_worker_name: str = Field(..., min_length=2, max_length=100)
    assigned_contractor: Optional[str] = None
    responsible_supervisor: str = Field(..., min_length=2, max_length=100)
    due_date: str
    description: Optional[str] = None


class SharedRepairSummaryResponse(BaseModel):
    id: str
    proposal_title: str
    shared_area_id: str
    shared_area_name: str
    responsible_org_id: Optional[str] = None
    responsible_org_name: Optional[str] = None
    proposed_method: str
    status: str
    expected_service_life_years: Optional[float] = None
    operational_interruption_hours: Optional[float] = None
    created_at: str


class OrganizationDashboardResponse(BaseModel):
    organization: OrganizationResponse
    properties: List[Dict[str, Any]]
    hazard_locations: List[Dict[str, Any]]
    private_work_orders: List[Dict[str, Any]]
    shared_work_orders: List[Dict[str, Any]]
    upcoming_inspections: List[Dict[str, Any]]
    group_memberships: List[Dict[str, Any]]
    invitations: List[Dict[str, Any]]
    data_sharing_permissions: List[Dict[str, Any]]

