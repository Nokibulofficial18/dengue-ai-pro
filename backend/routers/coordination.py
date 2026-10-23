"""
FastAPI Router for Improvement 05: Coordinated Prevention Across Properties.
Exposes REST endpoints for multi-property consortium management, shared areas,
group inspection calendars, shared work orders, responsibility handoffs,
data-sharing permissions, consortium meetings, action items, and operational reports.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from services.coordination_service import CoordinationService
from models.coordination_schemas import (
    OrganizationCreate, OrganizationUpdate, OrganizationResponse,
    CoordinationGroupCreate, CoordinationGroupUpdate, CoordinationGroupResponse,
    GroupMembershipCreate, MembershipWithdrawRequest, GroupMembershipResponse,
    GroupInvitationCreate, InvitationDecisionRequest, GroupInvitationResponse,
    SharedAreaCreate, SharedAreaUpdate, SharedAreaResponse,
    ResponsibilityHandoffCreate, ResponsibilityHandoffReviewRequest, ResponsibilityHandoffResponse,
    DataSharingPermissionCreate, DataSharingPermissionRevokeRequest, DataSharingPermissionResponse,
    CoordinationMeetingCreate, CoordinationMeetingResponse,
    CoordinationActionItemCreate, CoordinationActionItemUpdate, CoordinationActionItemResponse,
    CoordinationAuditLogResponse, GroupSummaryMetrics, GroupCoordinationReport,
    SharedInspectionCreate, SharedWorkOrderCreate, SharedRepairSummaryResponse,
    OrganizationDashboardResponse
)


router = APIRouter()


# ------------------------------------------------------------------------------
# Organizations
# ------------------------------------------------------------------------------

@router.get("/organizations", response_model=List[OrganizationResponse], tags=["Organizations"])
async def list_organizations(session: AsyncSession = Depends(get_db)):
    """List all registered organizations in the multi-property system."""
    return await CoordinationService.list_organizations(session)


@router.post("/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED, tags=["Organizations"])
async def create_organization(data: OrganizationCreate, session: AsyncSession = Depends(get_db)):
    """Register a new participating organization (factory, park operator, contractor, etc.)."""
    return await CoordinationService.create_organization(session, data)


@router.get("/organizations/{org_id}", response_model=OrganizationResponse, tags=["Organizations"])
async def get_organization(org_id: str, session: AsyncSession = Depends(get_db)):
    """Retrieve details of a specific organization."""
    org = await CoordinationService.get_organization(session, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.get("/organizations/{org_id}/properties", tags=["Organizations"])
async def get_organization_properties(org_id: str, session: AsyncSession = Depends(get_db)):
    """List properties owned or managed by an organization."""
    return await CoordinationService.get_organization_properties(session, org_id)


@router.get("/organizations/{org_id}/dashboard", response_model=OrganizationDashboardResponse, tags=["Organizations"])
async def get_organization_dashboard(org_id: str, session: AsyncSession = Depends(get_db)):
    """Retrieve tenant-isolated dashboard for a participating organization."""
    return await CoordinationService.get_organization_dashboard(session, org_id)


# ------------------------------------------------------------------------------
# Coordination Groups
# ------------------------------------------------------------------------------

@router.get("/coordination/groups", response_model=List[CoordinationGroupResponse], tags=["Coordination Groups"])
async def list_groups(session: AsyncSession = Depends(get_db)):
    """List all prevention coordination groups."""
    return await CoordinationService.list_groups(session)


@router.post("/coordination/groups", response_model=CoordinationGroupResponse, status_code=status.HTTP_201_CREATED, tags=["Coordination Groups"])
async def create_group(data: CoordinationGroupCreate, session: AsyncSession = Depends(get_db)):
    """Create a new coordination group (e.g. Industrial Park Consortium)."""
    return await CoordinationService.create_group(session, data)


@router.get("/coordination/groups/{group_id}", response_model=CoordinationGroupResponse, tags=["Coordination Groups"])
async def get_group(group_id: str, session: AsyncSession = Depends(get_db)):
    """Retrieve details for a coordination group."""
    group = await CoordinationService.get_group(session, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Coordination group not found")
    return group


@router.patch("/coordination/groups/{group_id}", response_model=CoordinationGroupResponse, tags=["Coordination Groups"])
async def update_group(group_id: str, data: CoordinationGroupUpdate, session: AsyncSession = Depends(get_db)):
    """Update coordination group description, scope, rules, or coordinator contact."""
    return await CoordinationService.update_group(session, group_id, data)



@router.get("/coordination/groups/{group_id}/members", response_model=List[GroupMembershipResponse], tags=["Coordination Groups"])
async def list_group_members(group_id: str, session: AsyncSession = Depends(get_db)):
    """List all participating organizations and contractors in a coordination group."""
    return await CoordinationService.list_memberships(session, group_id)


@router.post("/coordination/groups/{group_id}/members/{org_id}/withdraw", tags=["Coordination Groups"])
async def withdraw_membership(
    group_id: str, org_id: str, req: MembershipWithdrawRequest, session: AsyncSession = Depends(get_db)
):
    """Formally withdraw an organization from a coordination group."""
    return await CoordinationService.withdraw_membership(session, group_id, org_id, req)


# ------------------------------------------------------------------------------
# Invitations
# ------------------------------------------------------------------------------

@router.get("/coordination/invitations", response_model=List[GroupInvitationResponse], tags=["Coordination Invitations"])
async def list_invitations(
    group_id: Optional[str] = Query(None),
    org_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db)
):
    """List consortium invitations filtered by group or organization."""
    return await CoordinationService.list_invitations(session, group_id, org_id)


@router.post("/coordination/invitations", response_model=GroupInvitationResponse, status_code=status.HTTP_201_CREATED, tags=["Coordination Invitations"])
async def create_invitation(data: GroupInvitationCreate, session: AsyncSession = Depends(get_db)):
    """Send an invitation to an organization to join a coordination group."""
    return await CoordinationService.create_invitation(session, data)


@router.post("/coordination/invitations/{invitation_id}/decide", tags=["Coordination Invitations"])
async def decide_invitation(
    invitation_id: str, req: InvitationDecisionRequest, session: AsyncSession = Depends(get_db)
):
    """Accept or decline an invitation to join a coordination group."""
    return await CoordinationService.decide_invitation(session, invitation_id, req)


@router.post("/coordination/invitations/{invitation_id}/cancel", tags=["Coordination Invitations"])
async def cancel_invitation(
    invitation_id: str,
    cancelled_by: str = Query("Coordinator", min_length=2),
    reason: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db)
):
    """Revoke or cancel a pending group invitation."""
    return await CoordinationService.cancel_invitation(session, invitation_id, cancelled_by, reason)


# ------------------------------------------------------------------------------
# Shared Areas
# ------------------------------------------------------------------------------

@router.get("/coordination/groups/{group_id}/shared-areas", response_model=List[SharedAreaResponse], tags=["Shared Areas"])
async def list_shared_areas(group_id: str, session: AsyncSession = Depends(get_db)):
    """List shared corridors, roads, waste depots, and common spaces for a group."""
    return await CoordinationService.list_shared_areas(session, group_id)


@router.post("/coordination/groups/{group_id}/shared-areas", response_model=SharedAreaResponse, status_code=status.HTTP_201_CREATED, tags=["Shared Areas"])
async def create_shared_area(data: SharedAreaCreate, session: AsyncSession = Depends(get_db)):
    """Register a new shared area within a coordination group."""
    return await CoordinationService.create_shared_area(session, data)


@router.get("/coordination/shared-areas/{area_id}", response_model=SharedAreaResponse, tags=["Shared Areas"])
async def get_shared_area(area_id: str, session: AsyncSession = Depends(get_db)):
    """Retrieve details for a shared area."""
    area = await CoordinationService.get_shared_area(session, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Shared area not found")
    return area


@router.patch("/coordination/shared-areas/{area_id}", response_model=SharedAreaResponse, tags=["Shared Areas"])
async def update_shared_area(area_id: str, data: SharedAreaUpdate, session: AsyncSession = Depends(get_db)):
    """Update shared area details, status, or reassign responsible organization."""
    return await CoordinationService.update_shared_area(session, area_id, data)


# ------------------------------------------------------------------------------
# Shared Inspection Calendar, Shared Work Orders & Repair Planning
# ------------------------------------------------------------------------------

@router.get("/coordination/groups/{group_id}/calendar", tags=["Coordination Operations"])
async def get_group_calendar(group_id: str, session: AsyncSession = Depends(get_db)):
    """
    Retrieve aggregated group calendar of shared inspections and maintenance tasks.
    Enforces privacy boundaries: strictly excludes internal private building visits.
    """
    return await CoordinationService.get_group_calendar(session, group_id)


@router.post("/coordination/groups/{group_id}/shared-inspections", status_code=status.HTTP_201_CREATED, tags=["Coordination Operations"])
async def create_shared_inspection(
    group_id: str, data: SharedInspectionCreate, session: AsyncSession = Depends(get_db)
):
    """
    Schedule a coordinated shared-area inspection. Checks for duplicate visits to prevent
    redundant contractor assignments.
    """
    return await CoordinationService.create_shared_inspection(session, group_id, data)


@router.get("/coordination/groups/{group_id}/work-orders", tags=["Coordination Operations"])
async def list_shared_work_orders(group_id: str, session: AsyncSession = Depends(get_db)):
    """List maintenance work orders associated with consortium shared areas."""
    return await CoordinationService.list_shared_work_orders(session, group_id)


@router.post("/coordination/groups/{group_id}/shared-work-orders", status_code=status.HTTP_201_CREATED, tags=["Coordination Operations"])
async def create_shared_work_order(
    group_id: str, data: SharedWorkOrderCreate, session: AsyncSession = Depends(get_db)
):
    """
    Assign a maintenance task or larviciding work order to a shared corridor or common space.
    """
    return await CoordinationService.create_shared_work_order(session, group_id, data)


@router.get("/coordination/groups/{group_id}/repairs", response_model=List[SharedRepairSummaryResponse], tags=["Coordination Operations"])
async def get_shared_repairs(group_id: str, session: AsyncSession = Depends(get_db)):
    """
    Retrieve permitted shared repair proposals without revealing confidential supplier
    quotations, cost breakdowns, or corporate procurement rates.
    """
    return await CoordinationService.get_shared_repair_summaries(session, group_id)



# ------------------------------------------------------------------------------
# Responsibility Handoffs
# ------------------------------------------------------------------------------

@router.get("/coordination/groups/{group_id}/handoffs", response_model=List[ResponsibilityHandoffResponse], tags=["Responsibility Handoffs"])
async def list_handoffs(group_id: str, session: AsyncSession = Depends(get_db)):
    """List boundary problem responsibility handoffs."""
    return await CoordinationService.list_handoffs(session, group_id)


@router.post("/coordination/groups/{group_id}/handoffs", response_model=ResponsibilityHandoffResponse, status_code=status.HTTP_201_CREATED, tags=["Responsibility Handoffs"])
async def create_handoff(data: ResponsibilityHandoffCreate, session: AsyncSession = Depends(get_db)):
    """Initiate a formal responsibility handoff request across property boundaries."""
    return await CoordinationService.create_handoff(session, data)


@router.post("/coordination/handoffs/{handoff_id}/review", response_model=ResponsibilityHandoffResponse, tags=["Responsibility Handoffs"])
async def review_handoff(
    handoff_id: str, req: ResponsibilityHandoffReviewRequest, session: AsyncSession = Depends(get_db)
):
    """Review and accept or reject a boundary responsibility handoff request."""
    return await CoordinationService.review_handoff(session, handoff_id, req)


# ------------------------------------------------------------------------------
# Data Sharing Permissions
# ------------------------------------------------------------------------------

@router.get("/coordination/groups/{group_id}/permissions", response_model=List[DataSharingPermissionResponse], tags=["Data Sharing Permissions"])
async def list_permissions(group_id: str, session: AsyncSession = Depends(get_db)):
    """List explicit data sharing authorizations granted within the coordination group."""
    return await CoordinationService.list_permissions(session, group_id)


@router.post("/coordination/groups/{group_id}/permissions", response_model=DataSharingPermissionResponse, status_code=status.HTTP_201_CREATED, tags=["Data Sharing Permissions"])
async def create_permission(data: DataSharingPermissionCreate, session: AsyncSession = Depends(get_db)):
    """Grant an explicit data sharing authorization."""
    return await CoordinationService.create_permission(session, data)


@router.post("/coordination/permissions/{permission_id}/revoke", tags=["Data Sharing Permissions"])
async def revoke_permission(
    permission_id: str, req: DataSharingPermissionRevokeRequest, session: AsyncSession = Depends(get_db)
):
    """Revoke a previously granted data sharing authorization."""
    return await CoordinationService.revoke_permission(session, permission_id, req)


# ------------------------------------------------------------------------------
# Meetings & Action Items
# ------------------------------------------------------------------------------

@router.get("/coordination/groups/{group_id}/meetings", response_model=List[CoordinationMeetingResponse], tags=["Coordination Governance"])
async def list_meetings(group_id: str, session: AsyncSession = Depends(get_db)):
    """List consortium taskforce meetings and minutes."""
    return await CoordinationService.list_meetings(session, group_id)


@router.post("/coordination/groups/{group_id}/meetings", response_model=CoordinationMeetingResponse, status_code=status.HTTP_201_CREATED, tags=["Coordination Governance"])
async def create_meeting(data: CoordinationMeetingCreate, session: AsyncSession = Depends(get_db)):
    """Record a coordination group meeting and minutes."""
    return await CoordinationService.create_meeting(session, data)


@router.get("/coordination/groups/{group_id}/action-items", response_model=List[CoordinationActionItemResponse], tags=["Coordination Governance"])
async def list_action_items(group_id: str, session: AsyncSession = Depends(get_db)):
    """List action items assigned across consortium members."""
    return await CoordinationService.list_action_items(session, group_id)


@router.post("/coordination/groups/{group_id}/action-items", response_model=CoordinationActionItemResponse, status_code=status.HTTP_201_CREATED, tags=["Coordination Governance"])
async def create_action_item(data: CoordinationActionItemCreate, session: AsyncSession = Depends(get_db)):
    """Assign an action item to a participating organization."""
    return await CoordinationService.create_action_item(session, data)


@router.patch("/coordination/action-items/{action_id}", response_model=CoordinationActionItemResponse, tags=["Coordination Governance"])
async def update_action_item(
    action_id: str, data: CoordinationActionItemUpdate, session: AsyncSession = Depends(get_db)
):
    """Update action item status or record completion notes."""
    return await CoordinationService.update_action_item(session, action_id, data)


# ------------------------------------------------------------------------------
# Metrics, Reports & Audit
# ------------------------------------------------------------------------------

@router.get("/coordination/groups/{group_id}/metrics", response_model=GroupSummaryMetrics, tags=["Coordination Intelligence"])
async def get_group_metrics(group_id: str, session: AsyncSession = Depends(get_db)):
    """Retrieve operational summary metrics for a coordination group."""
    return await CoordinationService.get_group_summary_metrics(session, group_id)


@router.get("/coordination/groups/{group_id}/report", response_model=GroupCoordinationReport, tags=["Coordination Intelligence"])
async def generate_coordination_report(
    group_id: str,
    reporting_period: str = Query("Last 30 Days"),
    generated_by: str = Query("Consortium Secretariat"),
    session: AsyncSession = Depends(get_db)
):
    """Generate an official consortium operational and meeting progress report."""
    return await CoordinationService.generate_coordination_report(session, group_id, reporting_period, generated_by)


@router.get("/coordination/groups/{group_id}/audit-logs", response_model=List[CoordinationAuditLogResponse], tags=["Coordination Security"])
async def list_audit_logs(group_id: str, session: AsyncSession = Depends(get_db)):
    """List auditable security and governance log entries for the coordination group."""
    return await CoordinationService.list_audit_logs(session, group_id)
