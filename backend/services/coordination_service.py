"""
Core Business Logic Service for Improvement 05: Coordinated Prevention Across Properties.
Manages consortium lifecycle, organization memberships, invitations, shared areas,
group calendar aggregation, shared work orders, responsibility handoffs,
sharing permissions, meetings, action items, and operational reports.
"""
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from services.group_permission_service import GroupPermissionService
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


class CoordinationService:

    # --------------------------------------------------------------------------
    # Organizations
    # --------------------------------------------------------------------------

    @staticmethod
    async def list_organizations(session: AsyncSession) -> List[Dict[str, Any]]:
        query = text("""
            SELECT o.*,
                   (SELECT count(*) FROM properties p WHERE p.organization_id = o.id) as properties_count,
                   (SELECT count(*) FROM group_memberships m WHERE m.organization_id = o.id AND m.status = 'active') as memberships_count
            FROM organizations o
            ORDER BY o.name ASC
        """)
        result = await session.execute(query)
        return [dict(r) for r in result.mappings().all()]

    @staticmethod
    async def get_organization(session: AsyncSession, org_id: str) -> Optional[Dict[str, Any]]:
        query = text("""
            SELECT o.*,
                   (SELECT count(*) FROM properties p WHERE p.organization_id = o.id) as properties_count,
                   (SELECT count(*) FROM group_memberships m WHERE m.organization_id = o.id AND m.status = 'active') as memberships_count
            FROM organizations o
            WHERE o.id = :org_id
        """)
        result = await session.execute(query, {"org_id": org_id})
        row = result.mappings().first()
        return dict(row) if row else None

    @staticmethod
    async def create_organization(session: AsyncSession, data: OrganizationCreate) -> Dict[str, Any]:
        org_id = data.id or f"ORG-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        insert_sql = text("""
            INSERT INTO organizations
            (id, name, org_type, contact_email, contact_phone, authorized_representative,
             representative_role, address, status, created_at, updated_at)
            VALUES
            (:id, :name, :org_type, :contact_email, :contact_phone, :authorized_representative,
             :representative_role, :address, 'active', :created_at, :updated_at)
        """)
        await session.execute(insert_sql, {
            "id": org_id,
            "name": data.name,
            "org_type": data.org_type,
            "contact_email": data.contact_email,
            "contact_phone": data.contact_phone,
            "authorized_representative": data.authorized_representative,
            "representative_role": data.representative_role,
            "address": data.address,
            "created_at": now,
            "updated_at": now,
        })
        await session.commit()
        return await CoordinationService.get_organization(session, org_id)

    @staticmethod
    async def get_organization_properties(session: AsyncSession, org_id: str) -> List[Dict[str, Any]]:
        query = text("""
            SELECT p.*,
                   (SELECT count(*) FROM permanent_hazard_locations l WHERE l.property_id = p.id) as location_count
            FROM properties p
            WHERE p.organization_id = :org_id
            ORDER BY p.name ASC
        """)
        result = await session.execute(query, {"org_id": org_id})
        return [dict(r) for r in result.mappings().all()]

    # --------------------------------------------------------------------------
    # Coordination Groups
    # --------------------------------------------------------------------------

    @staticmethod
    async def list_groups(session: AsyncSession) -> List[Dict[str, Any]]:
        query = text("""
            SELECT g.*, o.name as managing_org_name,
                   (SELECT count(*) FROM group_memberships m WHERE m.group_id = g.id AND m.status = 'active') as member_count,
                   (SELECT count(*) FROM shared_areas sa WHERE sa.group_id = g.id AND sa.status != 'inactive') as shared_areas_count
            FROM coordination_groups g
            LEFT JOIN organizations o ON g.managing_org_id = o.id
            ORDER BY g.name ASC
        """)
        result = await session.execute(query)
        return [dict(r) for r in result.mappings().all()]

    @staticmethod
    async def get_group(session: AsyncSession, group_id: str) -> Optional[Dict[str, Any]]:
        query = text("""
            SELECT g.*, o.name as managing_org_name,
                   (SELECT count(*) FROM group_memberships m WHERE m.group_id = g.id AND m.status = 'active') as member_count,
                   (SELECT count(*) FROM shared_areas sa WHERE sa.group_id = g.id AND sa.status != 'inactive') as shared_areas_count
            FROM coordination_groups g
            LEFT JOIN organizations o ON g.managing_org_id = o.id
            WHERE g.id = :group_id
        """)
        result = await session.execute(query, {"group_id": group_id})
        row = result.mappings().first()
        return dict(row) if row else None

    @staticmethod
    async def create_group(session: AsyncSession, data: CoordinationGroupCreate) -> Dict[str, Any]:
        group_id = data.id or f"GRP-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        # Insert group
        await session.execute(
            text("""
                INSERT INTO coordination_groups
                (id, name, group_type, managing_org_id, description, geographic_scope,
                 boundary_geojson, coordinator_name, coordinator_contact, participation_rules,
                 status, created_at, updated_at)
                VALUES
                (:id, :name, :group_type, :managing_org_id, :description, :geographic_scope,
                 :boundary_geojson, :coordinator_name, :coordinator_contact, :participation_rules,
                 'active', :created_at, :updated_at)
            """),
            {
                "id": group_id,
                "name": data.name,
                "group_type": data.group_type,
                "managing_org_id": data.managing_org_id,
                "description": data.description,
                "geographic_scope": data.geographic_scope,
                "boundary_geojson": data.boundary_geojson,
                "coordinator_name": data.coordinator_name,
                "coordinator_contact": data.coordinator_contact,
                "participation_rules": data.participation_rules,
                "created_at": now,
                "updated_at": now,
            }
        )

        # Managing org automatically becomes 'managing_lead' member
        mem_id = f"MEM-{uuid.uuid4().hex[:6].upper()}"
        await session.execute(
            text("""
                INSERT INTO group_memberships
                (id, group_id, organization_id, role, status, joined_at, authorized_by, notes, created_at)
                VALUES
                (:id, :group_id, :organization_id, 'managing_lead', 'active', :joined_at, :authorized_by, 'Consortium managing organization', :created_at)
            """),
            {
                "id": mem_id,
                "group_id": group_id,
                "organization_id": data.managing_org_id,
                "joined_at": now,
                "authorized_by": data.coordinator_name,
                "created_at": now,
            }
        )

        # Log audit
        await GroupPermissionService.log_coordination_event(
            session, group_id, data.coordinator_name, data.managing_org_id,
            "group_created", "coordination_group", group_id,
            {"group_name": data.name, "managing_org_id": data.managing_org_id}
        )

        await session.commit()
        return await CoordinationService.get_group(session, group_id)

    @staticmethod
    async def update_group(session: AsyncSession, group_id: str, data: CoordinationGroupUpdate) -> Dict[str, Any]:
        existing = await CoordinationService.get_group(session, group_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Coordination group not found.")

        now = datetime.now(timezone.utc).isoformat()
        fields = []
        params = {"group_id": group_id, "updated_at": now}

        for attr, val in data.model_dump(exclude_unset=True).items():
            fields.append(f"{attr} = :{attr}")
            params[attr] = val

        if fields:
            fields.append("updated_at = :updated_at")
            sql = f"UPDATE coordination_groups SET {', '.join(fields)} WHERE id = :group_id"
            await session.execute(text(sql), params)
            await session.commit()

        return await CoordinationService.get_group(session, group_id)


    # --------------------------------------------------------------------------
    # Memberships & Invitations
    # --------------------------------------------------------------------------

    @staticmethod
    async def list_memberships(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        query = text("""
            SELECT m.*, o.name as organization_name, o.org_type, g.name as group_name
            FROM group_memberships m
            JOIN organizations o ON m.organization_id = o.id
            JOIN coordination_groups g ON m.group_id = g.id
            WHERE m.group_id = :group_id
            ORDER BY m.joined_at ASC
        """)
        result = await session.execute(query, {"group_id": group_id})
        return [dict(r) for r in result.mappings().all()]

    @staticmethod
    async def withdraw_membership(
        session: AsyncSession, group_id: str, org_id: str, req: MembershipWithdrawRequest
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()

        # Check membership
        check = await session.execute(
            text("SELECT id, role FROM group_memberships WHERE group_id = :group_id AND organization_id = :org_id AND status = 'active'"),
            {"group_id": group_id, "org_id": org_id}
        )
        row = check.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Active membership not found.")

        if row["role"] == "managing_lead":
            raise HTTPException(status_code=400, detail="Managing lead organization cannot withdraw without transferring group management.")

        # Update membership status
        await session.execute(
            text("""
                UPDATE group_memberships
                SET status = 'withdrawn', withdrawn_at = :withdrawn_at, withdrawal_reason = :withdrawal_reason
                WHERE group_id = :group_id AND organization_id = :org_id
            """),
            {
                "group_id": group_id,
                "org_id": org_id,
                "withdrawn_at": now,
                "withdrawal_reason": req.withdrawal_reason,
            }
        )

        # Flag any shared areas where this org was responsible
        await session.execute(
            text("""
                UPDATE shared_areas
                SET responsible_org_id = NULL, responsible_manager = NULL
                WHERE group_id = :group_id AND responsible_org_id = :org_id
            """),
            {"group_id": group_id, "org_id": org_id}
        )

        # Log audit
        await GroupPermissionService.log_coordination_event(
            session, group_id, req.authorized_by, org_id,
            "member_withdrawn", "group_membership", row["id"],
            {"reason": req.withdrawal_reason, "organization_id": org_id}
        )

        await session.commit()
        return {"status": "withdrawn", "group_id": group_id, "organization_id": org_id, "withdrawn_at": now}

    @staticmethod
    async def list_invitations(session: AsyncSession, group_id: Optional[str] = None, org_id: Optional[str] = None) -> List[Dict[str, Any]]:
        conditions = []
        params = {}
        if group_id:
            conditions.append("i.group_id = :group_id")
            params["group_id"] = group_id
        if org_id:
            conditions.append("(i.invited_org_id = :org_id OR i.inviting_org_id = :org_id)")
            params["org_id"] = org_id

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = text(f"""
            SELECT i.*,
                   g.name as group_name,
                   o_inv.name as invited_org_name,
                   o_by.name as inviting_org_name
            FROM group_invitations i
            JOIN coordination_groups g ON i.group_id = g.id
            JOIN organizations o_inv ON i.invited_org_id = o_inv.id
            JOIN organizations o_by ON i.inviting_org_id = o_by.id
            {where_clause}
            ORDER BY i.invited_at DESC
        """)
        result = await session.execute(query, params)
        return [dict(r) for r in result.mappings().all()]

    @staticmethod
    async def create_invitation(session: AsyncSession, data: GroupInvitationCreate) -> Dict[str, Any]:
        inv_id = f"INV-{uuid.uuid4().hex[:6].upper()}"
        token = f"INV-TOK-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=data.expires_in_days)).isoformat()
        now_str = now.isoformat()

        # Check existing active invite
        check = await session.execute(
            text("""
                SELECT id FROM group_invitations
                WHERE group_id = :group_id AND invited_org_id = :invited_org_id AND status = 'pending'
            """),
            {"group_id": data.group_id, "invited_org_id": data.invited_org_id}
        )
        if check.scalar():
            raise HTTPException(status_code=400, detail="A pending invitation already exists for this organization.")

        await session.execute(
            text("""
                INSERT INTO group_invitations
                (id, group_id, invited_org_id, inviting_org_id, invited_by_name, invitation_token,
                 message, status, invited_at, expires_at)
                VALUES
                (:id, :group_id, :invited_org_id, :inviting_org_id, :invited_by_name, :invitation_token,
                 :message, 'pending', :invited_at, :expires_at)
            """),
            {
                "id": inv_id,
                "group_id": data.group_id,
                "invited_org_id": data.invited_org_id,
                "inviting_org_id": data.inviting_org_id,
                "invited_by_name": data.invited_by_name,
                "invitation_token": token,
                "message": data.message,
                "invited_at": now_str,
                "expires_at": expires_at,
            }
        )

        await GroupPermissionService.log_coordination_event(
            session, data.group_id, data.invited_by_name, data.inviting_org_id,
            "invitation_sent", "group_invitation", inv_id,
            {"invited_org_id": data.invited_org_id, "token": token}
        )

        await session.commit()
        invs = await CoordinationService.list_invitations(session, group_id=data.group_id)
        return next(i for i in invs if i["id"] == inv_id)

    @staticmethod
    async def decide_invitation(
        session: AsyncSession, invitation_id: str, req: InvitationDecisionRequest
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()

        query = text("SELECT * FROM group_invitations WHERE id = :inv_id")
        result = await session.execute(query, {"inv_id": invitation_id})
        inv = result.mappings().first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found.")

        if inv["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Invitation already {inv['status']}.")

        decision_status = "accepted" if req.decision.lower() == "accept" else "declined"

        await session.execute(
            text("""
                UPDATE group_invitations
                SET status = :status, decided_at = :decided_at, decision_by_name = :decision_by_name,
                    decision_notes = :decision_notes
                WHERE id = :inv_id
            """),
            {
                "status": decision_status,
                "decided_at": now,
                "decision_by_name": req.decision_by_name,
                "decision_notes": req.decision_notes,
                "inv_id": invitation_id,
            }
        )

        if decision_status == "accepted":
            # Add membership
            mem_id = f"MEM-{uuid.uuid4().hex[:6].upper()}"
            await session.execute(
                text("""
                    INSERT OR REPLACE INTO group_memberships
                    (id, group_id, organization_id, role, status, joined_at, authorized_by, notes, created_at)
                    VALUES
                    (:id, :group_id, :organization_id, 'participating_member', 'active', :joined_at, :authorized_by, :notes, :created_at)
                """),
                {
                    "id": mem_id,
                    "group_id": inv["group_id"],
                    "organization_id": inv["invited_org_id"],
                    "joined_at": now,
                    "authorized_by": req.decision_by_name,
                    "notes": f"Accepted invitation {invitation_id}",
                    "created_at": now,
                }
            )

        await GroupPermissionService.log_coordination_event(
            session, inv["group_id"], req.decision_by_name, inv["invited_org_id"],
            f"invitation_{decision_status}", "group_invitation", invitation_id,
            {"decision": decision_status, "notes": req.decision_notes}
        )

        await session.commit()
        return {"status": decision_status, "invitation_id": invitation_id, "decided_at": now}

    @staticmethod
    async def cancel_invitation(
        session: AsyncSession, invitation_id: str, cancelled_by: str, reason: Optional[str] = None
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        query = text("SELECT * FROM group_invitations WHERE id = :inv_id")
        result = await session.execute(query, {"inv_id": invitation_id})
        inv = result.mappings().first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found.")

        if inv["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Cannot cancel invitation with status '{inv['status']}'.")

        await session.execute(
            text("""
                UPDATE group_invitations
                SET status = 'cancelled', decided_at = :now, decision_by_name = :by, decision_notes = :notes
                WHERE id = :inv_id
            """),
            {"now": now, "by": cancelled_by, "notes": reason or "Cancelled by coordinator", "inv_id": invitation_id}
        )
        await GroupPermissionService.log_coordination_event(
            session, inv["group_id"], cancelled_by, inv["inviting_org_id"],
            "invitation_cancelled", "group_invitation", invitation_id,
            {"reason": reason}
        )
        await session.commit()
        return {"status": "cancelled", "invitation_id": invitation_id, "decided_at": now}


    # --------------------------------------------------------------------------
    # Shared Areas
    # --------------------------------------------------------------------------

    @staticmethod
    async def list_shared_areas(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        query = text("""
            SELECT sa.*,
                   g.name as group_name,
                   o.name as responsible_org_name,
                   loc.name as linked_location_name,
                   (SELECT count(*) FROM service_work_orders wo WHERE wo.shared_area_id = sa.id AND wo.status IN ('assigned', 'in_progress')) as open_tasks_count,
                   (SELECT count(*) FROM scheduled_inspections si WHERE si.shared_area_id = sa.id AND si.status = 'scheduled') as upcoming_inspections_count
            FROM shared_areas sa
            JOIN coordination_groups g ON sa.group_id = g.id
            LEFT JOIN organizations o ON sa.responsible_org_id = o.id
            LEFT JOIN permanent_hazard_locations loc ON sa.linked_location_id = loc.id
            WHERE sa.group_id = :group_id AND sa.status != 'inactive'
            ORDER BY sa.name ASC
        """)
        result = await session.execute(query, {"group_id": group_id})
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            if not r["responsible_org_id"]:
                r["responsible_org_name"] = "Responsibility not assigned"
        return rows

    @staticmethod
    async def get_shared_area(session: AsyncSession, area_id: str) -> Optional[Dict[str, Any]]:
        query = text("""
            SELECT sa.*,
                   g.name as group_name,
                   o.name as responsible_org_name,
                   loc.name as linked_location_name,
                   (SELECT count(*) FROM service_work_orders wo WHERE wo.shared_area_id = sa.id AND wo.status IN ('assigned', 'in_progress')) as open_tasks_count,
                   (SELECT count(*) FROM scheduled_inspections si WHERE si.shared_area_id = sa.id AND si.status = 'scheduled') as upcoming_inspections_count
            FROM shared_areas sa
            JOIN coordination_groups g ON sa.group_id = g.id
            LEFT JOIN organizations o ON sa.responsible_org_id = o.id
            LEFT JOIN permanent_hazard_locations loc ON sa.linked_location_id = loc.id
            WHERE sa.id = :area_id
        """)
        result = await session.execute(query, {"area_id": area_id})
        row = result.mappings().first()
        if row:
            r = dict(row)
            if not r["responsible_org_id"]:
                r["responsible_org_name"] = "Responsibility not assigned"
            return r
        return None

    @staticmethod
    async def create_shared_area(session: AsyncSession, data: SharedAreaCreate) -> Dict[str, Any]:
        area_id = data.id or f"SA-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        await session.execute(
            text("""
                INSERT INTO shared_areas
                (id, group_id, name, area_type, description, latitude, longitude,
                 boundary_geojson, responsible_org_id, responsible_manager, linked_location_id,
                 visibility_classification, status, created_at, updated_at)
                VALUES
                (:id, :group_id, :name, :area_type, :description, :latitude, :longitude,
                 :boundary_geojson, :responsible_org_id, :responsible_manager, :linked_location_id,
                 :visibility_classification, 'active', :created_at, :updated_at)
            """),
            {
                "id": area_id,
                "group_id": data.group_id,
                "name": data.name,
                "area_type": data.area_type,
                "description": data.description,
                "latitude": data.latitude,
                "longitude": data.longitude,
                "boundary_geojson": data.boundary_geojson,
                "responsible_org_id": data.responsible_org_id,
                "responsible_manager": data.responsible_manager,
                "linked_location_id": data.linked_location_id,
                "visibility_classification": data.visibility_classification,
                "created_at": now,
                "updated_at": now,
            }
        )

        await GroupPermissionService.log_coordination_event(
            session, data.group_id, "Authorized Coordinator", data.responsible_org_id,
            "shared_area_registered", "shared_area", area_id,
            {"name": data.name, "area_type": data.area_type, "responsible_org_id": data.responsible_org_id}
        )

        await session.commit()
        return await CoordinationService.get_shared_area(session, area_id)

    @staticmethod
    async def update_shared_area(session: AsyncSession, area_id: str, data: SharedAreaUpdate) -> Dict[str, Any]:
        existing = await CoordinationService.get_shared_area(session, area_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Shared area not found.")

        now = datetime.now(timezone.utc).isoformat()
        fields = []
        params = {"area_id": area_id, "updated_at": now}

        for attr, val in data.model_dump(exclude_unset=True).items():
            fields.append(f"{attr} = :{attr}")
            params[attr] = val

        if fields:
            fields.append("updated_at = :updated_at")
            sql = f"UPDATE shared_areas SET {', '.join(fields)} WHERE id = :area_id"
            await session.execute(text(sql), params)

            if "responsible_org_id" in params:
                await GroupPermissionService.log_coordination_event(
                    session, existing["group_id"], "Authorized Coordinator", params["responsible_org_id"],
                    "responsibility_assigned", "shared_area", area_id,
                    {"new_responsible_org_id": params["responsible_org_id"]}
                )

            await session.commit()

        return await CoordinationService.get_shared_area(session, area_id)

    # --------------------------------------------------------------------------
    # Group Inspection Calendar & Shared Work Orders
    # --------------------------------------------------------------------------

    @staticmethod
    async def get_group_calendar(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        """
        Aggregates authorized scheduled inspections and shared work orders for the coordination group.
        Strictly excludes private factory inspections unless explicit permission is granted.
        """
        events = []

        # 1. Scheduled Inspections on Shared Areas (or with group reference)
        insp_query = text("""
            SELECT si.id, si.location_id, si.scheduled_date,
                   si.assigned_inspector, si.visit_type, si.status,
                   si.notes, si.created_at,
                   sa.id as shared_area_id, sa.name as shared_area_name, sa.area_type,
                   sa.responsible_org_id, o.name as responsible_org_name
            FROM scheduled_inspections si
            JOIN shared_areas sa ON (si.shared_area_id = sa.id OR si.location_id = sa.linked_location_id)
            LEFT JOIN organizations o ON sa.responsible_org_id = o.id
            WHERE sa.group_id = :group_id
            ORDER BY si.scheduled_date ASC
        """)
        insp_res = await session.execute(insp_query, {"group_id": group_id})
        for r in insp_res.mappings().all():
            events.append({
                "event_id": f"CAL-INSP-{r['id']}",
                "event_type": "shared_inspection",
                "title": f"Inspection: {r['shared_area_name']}",
                "scheduled_date": r["scheduled_date"],
                "time_slot": "Morning (09:00 - 12:00)",
                "shared_area_id": r["shared_area_id"],
                "shared_area_name": r["shared_area_name"],
                "responsible_org_name": r["responsible_org_name"] or "Responsibility not assigned",
                "assigned_team": r["assigned_inspector"] or "Joint Inspection Team",
                "priority": "high" if r["visit_type"] == "mandatory" else "normal",
                "status": r["status"],
                "weather_contingency": "Reschedule if heavy rain > 25mm",
            })

        # 2. Shared Work Orders
        wo_query = text("""
            SELECT wo.id, wo.title, wo.required_action, wo.assigned_worker_name,
                   wo.due_date as deadline, wo.status, wo.priority,
                   sa.id as shared_area_id, sa.name as shared_area_name,
                   sa.responsible_org_id, o.name as responsible_org_name
            FROM service_work_orders wo
            JOIN shared_areas sa ON (wo.shared_area_id = sa.id OR wo.location_id = sa.linked_location_id)
            LEFT JOIN organizations o ON sa.responsible_org_id = o.id
            WHERE sa.group_id = :group_id AND wo.status != 'cancelled'
            ORDER BY wo.due_date ASC
        """)
        wo_res = await session.execute(wo_query, {"group_id": group_id})
        for r in wo_res.mappings().all():
            events.append({
                "event_id": f"CAL-WO-{r['id']}",
                "event_type": "shared_work_order",
                "title": f"Maintenance Task: {r['title']}",
                "scheduled_date": r["deadline"],
                "time_slot": "Full Day",
                "shared_area_id": r["shared_area_id"],
                "shared_area_name": r["shared_area_name"],
                "responsible_org_name": r["responsible_org_name"] or "Responsibility not assigned",
                "assigned_team": r["assigned_worker_name"] or "Pending Worker Assignment",
                "priority": r["priority"],
                "status": r["status"],
                "weather_contingency": None,
            })

        # Sort combined events by scheduled_date
        events.sort(key=lambda x: x["scheduled_date"])
        return events

    @staticmethod
    async def list_shared_work_orders(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        query = text("""
            SELECT wo.id, wo.title, wo.required_action, wo.assigned_worker_name,
                   wo.due_date as deadline, wo.status, wo.priority, wo.created_at,
                   sa.id as shared_area_id, sa.name as shared_area_name, sa.area_type,
                   sa.responsible_org_id, o.name as responsible_org_name,
                   (SELECT count(*) FROM service_evidence_submissions s WHERE s.work_order_id = wo.id) as evidence_count,
                   (SELECT vr.verified_outcome FROM resolution_verification_records vr WHERE vr.work_order_id = wo.id ORDER BY vr.verified_at DESC LIMIT 1) as verification_status
            FROM service_work_orders wo
            JOIN shared_areas sa ON (wo.shared_area_id = sa.id OR wo.location_id = sa.linked_location_id)
            LEFT JOIN organizations o ON sa.responsible_org_id = o.id
            WHERE sa.group_id = :group_id
            ORDER BY wo.due_date ASC
        """)
        result = await session.execute(query, {"group_id": group_id})
        rows = [dict(r) for r in result.mappings().all()]
        sanitized = []
        for r in rows:
            safe = await GroupPermissionService.sanitize_work_order_for_consortium(r)
            if not safe.get("responsible_org_id"):
                safe["responsible_org_name"] = "Responsibility not assigned"
            sanitized.append(safe)
        return sanitized

    @staticmethod
    async def create_shared_inspection(session: AsyncSession, group_id: str, data: SharedInspectionCreate) -> Dict[str, Any]:
        sa = await CoordinationService.get_shared_area(session, data.shared_area_id)
        if not sa or sa["group_id"] != group_id:
            raise HTTPException(status_code=404, detail="Shared area not found in this group.")

        loc_id = sa.get("linked_location_id") or "LOC-MIR-01"

        # Check for duplicate approved/scheduled inspection on same day and location (Step 9)
        dup_query = text("""
            SELECT id FROM scheduled_inspections
            WHERE (shared_area_id = :sa_id OR location_id = :loc_id)
              AND scheduled_date = :s_date
              AND status IN ('scheduled', 'approved')
        """)
        dup_res = await session.execute(dup_query, {"sa_id": data.shared_area_id, "loc_id": loc_id, "s_date": data.scheduled_date})
        if dup_res.scalar():
            raise HTTPException(
                status_code=400,
                detail=f"An active inspection is already scheduled for '{sa['name']}' on {data.scheduled_date}."
            )

        insp_id = f"SCHED-SHR-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        await session.execute(
            text("""
                INSERT INTO scheduled_inspections
                (id, location_id, shared_area_id, coordination_group_id, scheduled_date,
                 visit_type, status, assigned_inspector, created_by, notes, created_at, updated_at)
                VALUES
                (:id, :location_id, :shared_area_id, :coordination_group_id, :scheduled_date,
                 :visit_type, 'scheduled', :assigned_inspector, :created_by, :notes, :created_at, :updated_at)
            """),
            {
                "id": insp_id,
                "location_id": loc_id,
                "shared_area_id": data.shared_area_id,
                "coordination_group_id": group_id,
                "scheduled_date": data.scheduled_date,
                "visit_type": data.visit_type,
                "assigned_inspector": data.assigned_inspector,
                "created_by": data.created_by,
                "notes": data.notes or f"Shared inspection for {sa['name']}",
                "created_at": now,
                "updated_at": now,
            }
        )

        await GroupPermissionService.log_coordination_event(
            session, group_id, data.created_by, sa.get("responsible_org_id"),
            "shared_inspection_scheduled", "scheduled_inspection", insp_id,
            {"shared_area_id": data.shared_area_id, "date": data.scheduled_date, "inspector": data.assigned_inspector}
        )

        await session.commit()
        return {
            "id": insp_id,
            "shared_area_id": data.shared_area_id,
            "shared_area_name": sa["name"],
            "scheduled_date": data.scheduled_date,
            "assigned_inspector": data.assigned_inspector,
            "status": "scheduled",
            "message": "Shared inspection scheduled successfully without duplicates"
        }

    @staticmethod
    async def create_shared_work_order(session: AsyncSession, group_id: str, data: SharedWorkOrderCreate) -> Dict[str, Any]:
        sa = await CoordinationService.get_shared_area(session, data.shared_area_id)
        if not sa or sa["group_id"] != group_id:
            raise HTTPException(status_code=404, detail="Shared area not found in this group.")

        loc_id = sa.get("linked_location_id") or "LOC-MIR-01"
        prop_query = text("SELECT property_id FROM permanent_hazard_locations WHERE id = :loc_id")
        prop_res = await session.execute(prop_query, {"loc_id": loc_id})
        prop_row = prop_res.mappings().first()
        property_id = prop_row["property_id"] if prop_row else "PROP-MIR-01"

        wo_id = f"WO-SHR-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        await session.execute(
            text("""
                INSERT INTO service_work_orders
                (id, property_id, location_id, coordination_group_id, shared_area_id,
                 title, description, required_action, priority, assigned_worker_name,
                 assigned_contractor, responsible_supervisor, due_date, status,
                 resolution_verification_status, created_at, updated_at)
                VALUES
                (:id, :property_id, :location_id, :coordination_group_id, :shared_area_id,
                 :title, :description, :required_action, :priority, :assigned_worker_name,
                 :assigned_contractor, :responsible_supervisor, :due_date, 'assigned',
                 'awaiting_followup', :created_at, :updated_at)
            """),
            {
                "id": wo_id,
                "property_id": property_id,
                "location_id": loc_id,
                "coordination_group_id": group_id,
                "shared_area_id": data.shared_area_id,
                "title": data.title,
                "description": data.description or f"Shared task for {sa['name']}",
                "required_action": data.required_action,
                "priority": data.priority,
                "assigned_worker_name": data.assigned_worker_name,
                "assigned_contractor": data.assigned_contractor or "CleanCare Industrial Vector Services",
                "responsible_supervisor": data.responsible_supervisor,
                "due_date": data.due_date,
                "created_at": now,
                "updated_at": now,
            }
        )

        await GroupPermissionService.log_coordination_event(
            session, group_id, data.responsible_supervisor, sa.get("responsible_org_id"),
            "shared_work_order_created", "service_work_order", wo_id,
            {"title": data.title, "shared_area_id": data.shared_area_id, "assigned_to": data.assigned_worker_name}
        )

        await session.commit()
        return {
            "id": wo_id,
            "shared_area_id": data.shared_area_id,
            "shared_area_name": sa["name"],
            "title": data.title,
            "status": "assigned",
            "due_date": data.due_date,
            "assigned_worker_name": data.assigned_worker_name,
            "assigned_contractor": data.assigned_contractor
        }


    # --------------------------------------------------------------------------
    # Responsibility Handoffs
    # --------------------------------------------------------------------------

    @staticmethod
    async def list_handoffs(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        query = text("""
            SELECT h.*,
                   g.name as group_name,
                   sa.name as shared_area_name,
                   o_orig.name as originating_org_name,
                   o_prop.name as proposed_receiving_org_name
            FROM responsibility_handoffs h
            JOIN coordination_groups g ON h.group_id = g.id
            LEFT JOIN shared_areas sa ON h.shared_area_id = sa.id
            JOIN organizations o_orig ON h.originating_org_id = o_orig.id
            JOIN organizations o_prop ON h.proposed_receiving_org_id = o_prop.id
            WHERE h.group_id = :group_id
            ORDER BY h.requested_at DESC
        """)
        result = await session.execute(query, {"group_id": group_id})
        return [dict(r) for r in result.mappings().all()]

    @staticmethod
    async def create_handoff(session: AsyncSession, data: ResponsibilityHandoffCreate) -> Dict[str, Any]:
        ho_id = f"HO-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        await session.execute(
            text("""
                INSERT INTO responsibility_handoffs
                (id, group_id, shared_area_id, work_order_id, issue_id, originating_org_id,
                 proposed_receiving_org_id, reason, boundary_evidence_summary, status,
                 requested_by_name, requested_at, created_at)
                VALUES
                (:id, :group_id, :shared_area_id, :work_order_id, :issue_id, :originating_org_id,
                 :proposed_receiving_org_id, :reason, :boundary_evidence_summary, 'pending_review',
                 :requested_by_name, :requested_at, :created_at)
            """),
            {
                "id": ho_id,
                "group_id": data.group_id,
                "shared_area_id": data.shared_area_id,
                "work_order_id": data.work_order_id,
                "issue_id": data.issue_id,
                "originating_org_id": data.originating_org_id,
                "proposed_receiving_org_id": data.proposed_receiving_org_id,
                "reason": data.reason,
                "boundary_evidence_summary": data.boundary_evidence_summary,
                "requested_by_name": data.requested_by_name,
                "requested_at": now,
                "created_at": now,
            }
        )

        await GroupPermissionService.log_coordination_event(
            session, data.group_id, data.requested_by_name, data.originating_org_id,
            "handoff_requested", "responsibility_handoff", ho_id,
            {
                "proposed_receiving_org_id": data.proposed_receiving_org_id,
                "shared_area_id": data.shared_area_id,
                "reason": data.reason
            }
        )

        await session.commit()
        handoffs = await CoordinationService.list_handoffs(session, data.group_id)
        return next(h for h in handoffs if h["id"] == ho_id)

    @staticmethod
    async def review_handoff(
        session: AsyncSession, handoff_id: str, req: ResponsibilityHandoffReviewRequest
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()

        query = text("SELECT * FROM responsibility_handoffs WHERE id = :ho_id")
        result = await session.execute(query, {"ho_id": handoff_id})
        ho = result.mappings().first()
        if not ho:
            raise HTTPException(status_code=404, detail="Handoff request not found.")

        if ho["status"] != "pending_review":
            raise HTTPException(status_code=400, detail=f"Handoff request already {ho['status']}.")

        decision_status = req.decision.lower()
        if decision_status not in ["accept", "accepted", "reject", "rejected", "clarification_requested"]:
            raise HTTPException(status_code=400, detail="Invalid decision.")

        status_val = "accepted" if "accept" in decision_status else ("rejected" if "reject" in decision_status else "clarification_requested")

        await session.execute(
            text("""
                UPDATE responsibility_handoffs
                SET status = :status, reviewed_by_name = :reviewed_by_name, reviewed_at = :reviewed_at,
                    review_decision_notes = :review_decision_notes
                WHERE id = :ho_id
            """),
            {
                "status": status_val,
                "reviewed_by_name": req.reviewed_by_name,
                "reviewed_at": now,
                "review_decision_notes": req.review_decision_notes,
                "ho_id": handoff_id,
            }
        )

        # If accepted, formally transfer responsibility of the shared area!
        if status_val == "accepted" and ho["shared_area_id"]:
            await session.execute(
                text("""
                    UPDATE shared_areas
                    SET responsible_org_id = :new_org_id, responsible_manager = :manager, updated_at = :now
                    WHERE id = :area_id
                """),
                {
                    "new_org_id": ho["proposed_receiving_org_id"],
                    "manager": req.reviewed_by_name,
                    "now": now,
                    "area_id": ho["shared_area_id"],
                }
            )

        await GroupPermissionService.log_coordination_event(
            session, ho["group_id"], req.reviewed_by_name, ho["proposed_receiving_org_id"],
            f"handoff_{status_val}", "responsibility_handoff", handoff_id,
            {"decision": status_val, "notes": req.review_decision_notes}
        )

        await session.commit()
        handoffs = await CoordinationService.list_handoffs(session, ho["group_id"])
        return next(h for h in handoffs if h["id"] == handoff_id)

    # --------------------------------------------------------------------------
    # Data Sharing Permissions
    # --------------------------------------------------------------------------

    @staticmethod
    async def list_permissions(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        query = text("""
            SELECT p.*,
                   g.name as group_name,
                   o_src.name as source_org_name,
                   o_rcv.name as receiving_org_name
            FROM data_sharing_permissions p
            JOIN coordination_groups g ON p.group_id = g.id
            JOIN organizations o_src ON p.source_org_id = o_src.id
            LEFT JOIN organizations o_rcv ON p.receiving_org_id = o_rcv.id
            WHERE p.group_id = :group_id
            ORDER BY p.granted_at DESC
        """)
        result = await session.execute(query, {"group_id": group_id})
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            if not r["receiving_org_id"]:
                r["receiving_org_name"] = "All Consortium Members"
        return rows

    @staticmethod
    async def create_permission(session: AsyncSession, data: DataSharingPermissionCreate) -> Dict[str, Any]:
        perm_id = f"PERM-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        await session.execute(
            text("""
                INSERT INTO data_sharing_permissions
                (id, group_id, source_org_id, receiving_org_id, information_category,
                 permitted_access_level, sharing_purpose, is_revoked, granted_by_name,
                 granted_at, expires_at)
                VALUES
                (:id, :group_id, :source_org_id, :receiving_org_id, :information_category,
                 :permitted_access_level, :sharing_purpose, 0, :granted_by_name,
                 :granted_at, :expires_at)
            """),
            {
                "id": perm_id,
                "group_id": data.group_id,
                "source_org_id": data.source_org_id,
                "receiving_org_id": data.receiving_org_id,
                "information_category": data.information_category,
                "permitted_access_level": data.permitted_access_level,
                "sharing_purpose": data.sharing_purpose,
                "granted_by_name": data.granted_by_name,
                "granted_at": now,
                "expires_at": data.expires_at,
            }
        )

        await GroupPermissionService.log_coordination_event(
            session, data.group_id, data.granted_by_name, data.source_org_id,
            "permission_granted", "data_sharing_permission", perm_id,
            {"category": data.information_category, "level": data.permitted_access_level}
        )

        await session.commit()
        perms = await CoordinationService.list_permissions(session, data.group_id)
        return next(p for p in perms if p["id"] == perm_id)

    @staticmethod
    async def revoke_permission(
        session: AsyncSession, permission_id: str, req: DataSharingPermissionRevokeRequest
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()

        query = text("SELECT * FROM data_sharing_permissions WHERE id = :perm_id")
        result = await session.execute(query, {"perm_id": permission_id})
        perm = result.mappings().first()
        if not perm:
            raise HTTPException(status_code=404, detail="Permission record not found.")

        await session.execute(
            text("""
                UPDATE data_sharing_permissions
                SET is_revoked = 1, revoked_by_name = :revoked_by_name, revoked_at = :revoked_at,
                    revocation_reason = :revocation_reason
                WHERE id = :perm_id
            """),
            {
                "revoked_by_name": req.revoked_by_name,
                "revoked_at": now,
                "revocation_reason": req.revocation_reason,
                "perm_id": permission_id,
            }
        )

        await GroupPermissionService.log_coordination_event(
            session, perm["group_id"], req.revoked_by_name, perm["source_org_id"],
            "permission_revoked", "data_sharing_permission", permission_id,
            {"reason": req.revocation_reason}
        )

        await session.commit()
        return {"status": "revoked", "permission_id": permission_id, "revoked_at": now}

    # --------------------------------------------------------------------------
    # Meetings & Action Items
    # --------------------------------------------------------------------------

    @staticmethod
    async def list_meetings(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        query = text("""
            SELECT m.*, o.name as chairperson_org_name,
                   (SELECT count(*) FROM coordination_action_items a WHERE a.meeting_id = m.id) as action_items_count
            FROM coordination_meetings m
            JOIN organizations o ON m.chairperson_org_id = o.id
            WHERE m.group_id = :group_id
            ORDER BY m.meeting_date DESC
        """)
        result = await session.execute(query, {"group_id": group_id})
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            try:
                r["attendees"] = json.loads(r["attendees_json"]) if r.get("attendees_json") else []
            except Exception:
                r["attendees"] = []
        return rows

    @staticmethod
    async def create_meeting(session: AsyncSession, data: CoordinationMeetingCreate) -> Dict[str, Any]:
        mtg_id = f"MTG-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        attendees_json = json.dumps(data.attendees)

        await session.execute(
            text("""
                INSERT INTO coordination_meetings
                (id, group_id, meeting_title, meeting_date, chairperson_name, chairperson_org_id,
                 attendees_json, discussion_summary, next_meeting_date, created_at)
                VALUES
                (:id, :group_id, :meeting_title, :meeting_date, :chairperson_name, :chairperson_org_id,
                 :attendees_json, :discussion_summary, :next_meeting_date, :created_at)
            """),
            {
                "id": mtg_id,
                "group_id": data.group_id,
                "meeting_title": data.meeting_title,
                "meeting_date": data.meeting_date,
                "chairperson_name": data.chairperson_name,
                "chairperson_org_id": data.chairperson_org_id,
                "attendees_json": attendees_json,
                "discussion_summary": data.discussion_summary,
                "next_meeting_date": data.next_meeting_date,
                "created_at": now,
            }
        )

        await GroupPermissionService.log_coordination_event(
            session, data.group_id, data.chairperson_name, data.chairperson_org_id,
            "meeting_logged", "coordination_meeting", mtg_id,
            {"title": data.meeting_title, "meeting_date": data.meeting_date}
        )

        await session.commit()
        meetings = await CoordinationService.list_meetings(session, data.group_id)
        return next(m for m in meetings if m["id"] == mtg_id)

    @staticmethod
    async def list_action_items(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        query = text("""
            SELECT a.*,
                   o.name as assigned_org_name,
                   sa.name as linked_shared_area_name
            FROM coordination_action_items a
            JOIN organizations o ON a.assigned_org_id = o.id
            LEFT JOIN shared_areas sa ON a.linked_shared_area_id = sa.id
            WHERE a.group_id = :group_id
            ORDER BY a.due_date ASC
        """)
        result = await session.execute(query, {"group_id": group_id})
        return [dict(r) for r in result.mappings().all()]

    @staticmethod
    async def create_action_item(session: AsyncSession, data: CoordinationActionItemCreate) -> Dict[str, Any]:
        act_id = f"ACT-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()

        await session.execute(
            text("""
                INSERT INTO coordination_action_items
                (id, meeting_id, group_id, action_title, description, assigned_org_id,
                 assigned_lead_name, due_date, status, linked_shared_area_id,
                 linked_work_order_id, created_at)
                VALUES
                (:id, :meeting_id, :group_id, :action_title, :description, :assigned_org_id,
                 :assigned_lead_name, :due_date, 'pending', :linked_shared_area_id,
                 :linked_work_order_id, :created_at)
            """),
            {
                "id": act_id,
                "meeting_id": data.meeting_id,
                "group_id": data.group_id,
                "action_title": data.action_title,
                "description": data.description,
                "assigned_org_id": data.assigned_org_id,
                "assigned_lead_name": data.assigned_lead_name,
                "due_date": data.due_date,
                "linked_shared_area_id": data.linked_shared_area_id,
                "linked_work_order_id": data.linked_work_order_id,
                "created_at": now,
            }
        )

        await session.commit()
        items = await CoordinationService.list_action_items(session, data.group_id)
        return next(i for i in items if i["id"] == act_id)

    @staticmethod
    async def update_action_item(session: AsyncSession, action_id: str, data: CoordinationActionItemUpdate) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        fields = []
        params = {"action_id": action_id}

        for attr, val in data.model_dump(exclude_unset=True).items():
            fields.append(f"{attr} = :{attr}")
            params[attr] = val

        if "status" in params and params["status"] == "completed":
            fields.append("completed_at = :completed_at")
            params["completed_at"] = now

        if fields:
            sql = f"UPDATE coordination_action_items SET {', '.join(fields)} WHERE id = :action_id"
            await session.execute(text(sql), params)
            await session.commit()

        # Find item
        query = text("""
            SELECT a.*, o.name as assigned_org_name, sa.name as linked_shared_area_name
            FROM coordination_action_items a
            JOIN organizations o ON a.assigned_org_id = o.id
            LEFT JOIN shared_areas sa ON a.linked_shared_area_id = sa.id
            WHERE a.id = :action_id
        """)
        res = await session.execute(query, {"action_id": action_id})
        return dict(res.mappings().first())

    # --------------------------------------------------------------------------
    # Audit Logs
    # --------------------------------------------------------------------------

    @staticmethod
    async def list_audit_logs(session: AsyncSession, group_id: Optional[str] = None) -> List[Dict[str, Any]]:
        conditions = []
        params = {}
        if group_id:
            conditions.append("l.group_id = :group_id")
            params["group_id"] = group_id

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = text(f"""
            SELECT l.*, o.name as actor_org_name
            FROM coordination_audit_logs l
            LEFT JOIN organizations o ON l.actor_org_id = o.id
            {where_clause}
            ORDER BY l.timestamp DESC
            LIMIT 100
        """)
        result = await session.execute(query, params)
        rows = [dict(r) for r in result.mappings().all()]
        for r in rows:
            try:
                r["details"] = json.loads(r["details_json"]) if r.get("details_json") else {}
            except Exception:
                r["details"] = {}
        return rows

    # --------------------------------------------------------------------------
    # Summary Metrics & Operational Report
    # --------------------------------------------------------------------------

    @staticmethod
    async def get_group_summary_metrics(session: AsyncSession, group_id: str) -> Dict[str, Any]:
        group = await CoordinationService.get_group(session, group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Coordination group not found.")

        # Total participating orgs
        orgs_res = await session.execute(
            text("SELECT count(*) FROM group_memberships WHERE group_id = :g_id AND status = 'active'"),
            {"g_id": group_id}
        )
        total_orgs = orgs_res.scalar() or 0

        # Shared areas
        sa_res = await session.execute(
            text("""
                SELECT count(*) as total,
                       sum(CASE WHEN responsible_org_id IS NOT NULL THEN 1 ELSE 0 END) as assigned
                FROM shared_areas
                WHERE group_id = :g_id AND status != 'inactive'
            """),
            {"g_id": group_id}
        )
        sa_row = sa_res.mappings().first()
        total_sa = sa_row["total"] or 0
        assigned_sa = sa_row["assigned"] or 0
        pct_assigned = round((assigned_sa / total_sa * 100.0), 1) if total_sa > 0 else 0.0

        # Upcoming shared inspections
        now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        insp_res = await session.execute(
            text("""
                SELECT count(*)
                FROM scheduled_inspections si
                JOIN shared_areas sa ON (si.shared_area_id = sa.id OR si.location_id = sa.linked_location_id)
                WHERE sa.group_id = :g_id AND si.scheduled_date >= :now_date AND si.status = 'scheduled'
            """),
            {"g_id": group_id, "now_date": now_date}
        )
        upcoming_insp = insp_res.scalar() or 0

        # Open shared work orders
        wo_res = await session.execute(
            text("""
                SELECT count(*) as open_cnt,
                       sum(CASE WHEN wo.due_date < :now_date AND wo.status != 'resolved' THEN 1 ELSE 0 END) as overdue_cnt
                FROM service_work_orders wo
                JOIN shared_areas sa ON (wo.shared_area_id = sa.id OR wo.location_id = sa.linked_location_id)
                WHERE sa.group_id = :g_id AND wo.status IN ('assigned', 'in_progress', 'pending_approval')
            """),
            {"g_id": group_id, "now_date": now_date}
        )
        wo_row = wo_res.mappings().first()
        open_wo = wo_row["open_cnt"] or 0
        overdue_tasks = wo_row["overdue_cnt"] or 0

        # Verified shared services
        verif_res = await session.execute(
            text("""
                SELECT count(*)
                FROM resolution_verification_records vr
                JOIN service_work_orders wo ON vr.work_order_id = wo.id
                JOIN shared_areas sa ON (wo.shared_area_id = sa.id OR wo.location_id = sa.linked_location_id)
                WHERE sa.group_id = :g_id AND vr.verified_outcome IN ('fully_resolved', 'temporary_relief')
            """),
            {"g_id": group_id}
        )
        verified_services = verif_res.scalar() or 0

        # Pending handoffs
        ho_res = await session.execute(
            text("SELECT count(*) FROM responsibility_handoffs WHERE group_id = :g_id AND status = 'pending_review'"),
            {"g_id": group_id}
        )
        pending_handoffs = ho_res.scalar() or 0

        return {
            "group_id": group_id,
            "group_name": group["name"],
            "total_participating_orgs": total_orgs,
            "total_shared_areas": total_sa,
            "shared_areas_with_assigned_owner": assigned_sa,
            "percentage_shared_areas_assigned": pct_assigned,
            "upcoming_shared_inspections_count": upcoming_insp,
            "open_shared_work_orders_count": open_wo,
            "overdue_shared_tasks_count": overdue_tasks,
            "verified_shared_services_count": verified_services,
            "pending_handoffs_count": pending_handoffs,
            "unassigned_shared_areas_count": total_sa - assigned_sa,
        }

    @staticmethod
    async def generate_coordination_report(
        session: AsyncSession, group_id: str, reporting_period: str = "Last 30 Days", generated_by: str = "Consortium Secretariat"
    ) -> Dict[str, Any]:
        group = await CoordinationService.get_group(session, group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Coordination group not found.")

        metrics = await CoordinationService.get_group_summary_metrics(session, group_id)
        members = await CoordinationService.list_memberships(session, group_id)
        shared_areas = await CoordinationService.list_shared_areas(session, group_id)
        action_items = await CoordinationService.list_action_items(session, group_id)
        calendar = await CoordinationService.get_group_calendar(session, group_id)

        # Filter completed inspections count
        insp_done_res = await session.execute(
            text("""
                SELECT count(*)
                FROM location_inspections li
                JOIN shared_areas sa ON li.location_id = sa.linked_location_id
                WHERE sa.group_id = :g_id
            """),
            {"g_id": group_id}
        )
        inspections_completed = insp_done_res.scalar() or 0

        now_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        insp_overdue_res = await session.execute(
            text("""
                SELECT count(*)
                FROM scheduled_inspections si
                JOIN shared_areas sa ON (si.shared_area_id = sa.id OR si.location_id = sa.linked_location_id)
                WHERE sa.group_id = :g_id AND si.scheduled_date < :now_date AND si.status = 'scheduled'
            """),
            {"g_id": group_id, "now_date": now_date}
        )
        inspections_overdue = insp_overdue_res.scalar() or 0

        # Outstanding shared issues
        issues_res = await session.execute(
            text("""
                SELECT count(*)
                FROM location_issues iss
                JOIN shared_areas sa ON iss.location_id = sa.linked_location_id
                WHERE sa.group_id = :g_id AND iss.status IN ('open', 'in_progress', 'recurring')
            """),
            {"g_id": group_id}
        )
        outstanding_issues = issues_res.scalar() or 0

        now_str = datetime.now(timezone.utc).isoformat()

        # Log audit
        await GroupPermissionService.log_coordination_event(
            session, group_id, generated_by, group["managing_org_id"],
            "report_exported", "coordination_report", f"REP-{group_id}",
            {"reporting_period": reporting_period}
        )
        await session.commit()

        return {
            "group_id": group_id,
            "group_name": group["name"],
            "managing_org_name": group.get("managing_org_name") or "Estate Management",
            "reporting_period": reporting_period,
            "participating_orgs": [
                {
                    "org_id": m["organization_id"],
                    "name": m["organization_name"],
                    "role": m["role"],
                    "joined_at": m["joined_at"],
                }
                for m in members if m["status"] == "active"
            ],
            "shared_areas_summary": [
                {
                    "area_id": sa["id"],
                    "name": sa["name"],
                    "type": sa["area_type"],
                    "responsible_org": sa["responsible_org_name"],
                    "status": sa["status"],
                    "open_tasks": sa["open_tasks_count"],
                }
                for sa in shared_areas
            ],
            "inspections_completed_count": inspections_completed,
            "inspections_overdue_count": inspections_overdue,
            "shared_tasks_completed_count": metrics["verified_shared_services_count"],
            "outstanding_shared_issues_count": outstanding_issues,
            "pending_responsibility_handoffs_count": metrics["pending_handoffs_count"],
            "upcoming_activities": calendar[:8],
            "agreed_action_items": action_items,
            "metrics": metrics,
            "generated_at": now_str,
            "generated_by": generated_by,
        }

    @staticmethod
    async def get_shared_repair_summaries(session: AsyncSession, group_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves operational summaries of repair proposals linked to shared areas.
        Financial quotes, contractor bids, and unit economics are strictly excluded
        to prevent sensitive corporate expenditure leaks across consortium partners.
        """
        query = text("""
            SELECT rp.id, rp.title as proposal_title, rp.proposed_method, rp.status,
                   rp.expected_service_life_years, rp.operational_interruption_hours, rp.created_at,
                   sa.id as shared_area_id, sa.name as shared_area_name,
                   sa.responsible_org_id, o.name as responsible_org_name
            FROM repair_proposals rp
            JOIN shared_areas sa ON rp.location_id = sa.linked_location_id
            LEFT JOIN organizations o ON sa.responsible_org_id = o.id
            WHERE sa.group_id = :group_id
            ORDER BY rp.created_at DESC
        """)
        res = await session.execute(query, {"group_id": group_id})
        rows = [dict(r) for r in res.mappings().all()]
        for r in rows:
            if not r["responsible_org_id"]:
                r["responsible_org_name"] = "Responsibility not assigned"
        return rows

    @staticmethod
    async def get_organization_dashboard(session: AsyncSession, org_id: str) -> Dict[str, Any]:
        """
        Provides a tenant-isolated portal for a specific participating organization.
        Shows the organization's owned properties, internal hazards, private work orders,
        authorized shared activities, group memberships, invitations, and data sharing grants.
        """
        org = await CoordinationService.get_organization(session, org_id)
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

        # 1. Properties owned/managed
        props = await CoordinationService.get_organization_properties(session, org_id)
        prop_ids = [p["id"] for p in props]

        # 2. Hazard locations on managed properties
        locations = []
        if prop_ids:
            loc_placeholders = ", ".join([f":pid_{i}" for i in range(len(prop_ids))])
            loc_params = {f"pid_{i}": pid for i, pid in enumerate(prop_ids)}
            loc_query = text(f"""
                SELECT l.*, p.name as property_name,
                       (SELECT count(*) FROM location_issues i WHERE i.location_id = l.id AND i.status != 'resolved') as active_issues_count
                FROM permanent_hazard_locations l
                JOIN properties p ON l.property_id = p.id
                WHERE l.property_id IN ({loc_placeholders})
                ORDER BY l.name ASC
            """)
            loc_res = await session.execute(loc_query, loc_params)
            locations = [dict(r) for r in loc_res.mappings().all()]

        # 3. Private work orders
        p_wo = []
        if prop_ids:
            wo_placeholders = ", ".join([f":wpid_{i}" for i in range(len(prop_ids))])
            wo_params = {f"wpid_{i}": pid for i, pid in enumerate(prop_ids)}
            wo_query = text(f"""
                SELECT wo.*, p.name as property_name, l.name as location_name
                FROM service_work_orders wo
                JOIN properties p ON wo.property_id = p.id
                JOIN permanent_hazard_locations l ON wo.location_id = l.id
                WHERE wo.property_id IN ({wo_placeholders})
                  AND wo.shared_area_id IS NULL
                ORDER BY wo.due_date ASC
            """)
            wo_res = await session.execute(wo_query, wo_params)
            p_wo = [dict(r) for r in wo_res.mappings().all()]

        # 4. Shared work orders (where this org is responsible or assigned contractor)
        s_wo_query = text("""
            SELECT wo.id, wo.title, wo.required_action, wo.assigned_worker_name,
                   wo.due_date, wo.status, wo.priority,
                   sa.id as shared_area_id, sa.name as shared_area_name,
                   o.name as responsible_org_name
            FROM service_work_orders wo
            JOIN shared_areas sa ON wo.shared_area_id = sa.id
            LEFT JOIN organizations o ON sa.responsible_org_id = o.id
            WHERE sa.responsible_org_id = :org_id
               OR wo.assigned_contractor LIKE :org_name_like
            ORDER BY wo.due_date ASC
        """)
        s_wo_res = await session.execute(s_wo_query, {"org_id": org_id, "org_name_like": f"%{org['name'][:10]}%"})
        shared_wo = [dict(r) for r in s_wo_res.mappings().all()]

        # 5. Upcoming inspections
        inspections = []
        if prop_ids:
            insp_placeholders = ", ".join([f":ipid_{i}" for i in range(len(prop_ids))])
            insp_params = {f"ipid_{i}": pid for i, pid in enumerate(prop_ids)}
            insp_query = text(f"""
                SELECT si.*, l.name as location_name, p.name as property_name
                FROM scheduled_inspections si
                JOIN permanent_hazard_locations l ON si.location_id = l.id
                JOIN properties p ON l.property_id = p.id
                WHERE l.property_id IN ({insp_placeholders})
                ORDER BY si.scheduled_date ASC
            """)
            insp_res = await session.execute(insp_query, insp_params)
            inspections = [dict(r) for r in insp_res.mappings().all()]

        # 6. Group memberships
        mem_query = text("""
            SELECT m.*, g.name as group_name, g.group_type, g.coordinator_name
            FROM group_memberships m
            JOIN coordination_groups g ON m.group_id = g.id
            WHERE m.organization_id = :org_id AND m.status = 'active'
        """)
        mem_res = await session.execute(mem_query, {"org_id": org_id})
        memberships = [dict(r) for r in mem_res.mappings().all()]

        # 7. Invitations
        invitations = await CoordinationService.list_invitations(session, org_id=org_id)

        # 8. Data sharing permissions
        perm_query = text("""
            SELECT p.*, g.name as group_name
            FROM data_sharing_permissions p
            JOIN coordination_groups g ON p.group_id = g.id
            WHERE (p.source_org_id = :org_id OR p.receiving_org_id = :org_id OR p.receiving_org_id IS NULL)
              AND p.is_revoked = 0
            ORDER BY p.granted_at DESC
        """)
        perm_res = await session.execute(perm_query, {"org_id": org_id})
        perms = [dict(r) for r in perm_res.mappings().all()]

        return {
            "organization": org,
            "properties": props,
            "hazard_locations": locations,
            "private_work_orders": p_wo,
            "shared_work_orders": shared_wo,
            "upcoming_inspections": inspections,
            "group_memberships": memberships,
            "invitations": invitations,
            "data_sharing_permissions": perms,
        }

