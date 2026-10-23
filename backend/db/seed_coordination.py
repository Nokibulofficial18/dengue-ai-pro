"""
Seed data for Improvement 05: Coordinated Prevention Across Properties.
Populates participating organizations, industrial park consortium group,
memberships, invitations, shared areas, responsibility handoffs,
sharing permissions, meetings, action items, and audit logs.
"""
import json
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


ORGANIZATIONS = [
    {
        "id": "ORG-EPZ-MGMT",
        "name": "Dhaka EPZ Industrial Estate Management Authority",
        "org_type": "industrial_park_operator",
        "contact_email": "estate.mgmt@depz.gov.bd",
        "contact_phone": "+880-2-7788991",
        "authorized_representative": "Engr. Tariqul Islam",
        "representative_role": "Chief Infrastructure Officer",
        "address": "Ganakbari, Savar, Dhaka EPZ Administrative Complex",
        "status": "active",
        "created_at": "2026-01-10T08:00:00Z",
        "updated_at": "2026-10-01T09:00:00Z",
    },
    {
        "id": "ORG-BENGAL-APP",
        "name": "Bengal Apparel & Textiles Ltd.",
        "org_type": "factory_company",
        "contact_email": "n.akhter@bengalapparel.com",
        "contact_phone": "+880-1711-234567",
        "authorized_representative": "Nasreen Akhter",
        "representative_role": "Head of Environmental Compliance",
        "address": "Plot 14-16, Sector 3, Dhaka EPZ",
        "status": "active",
        "created_at": "2026-02-01T09:30:00Z",
        "updated_at": "2026-10-15T11:00:00Z",
    },
    {
        "id": "ORG-DELTA-MFG",
        "name": "Delta Precision Engineering Ltd.",
        "org_type": "factory_company",
        "contact_email": "r.hasan@deltamfg.com",
        "contact_phone": "+880-1819-345678",
        "authorized_representative": "Rafiqul Hasan",
        "representative_role": "Factory Operations Manager",
        "address": "Plot 22-24, Sector 3, Dhaka EPZ",
        "status": "active",
        "created_at": "2026-02-15T10:00:00Z",
        "updated_at": "2026-10-12T14:30:00Z",
    },
    {
        "id": "ORG-APEX-PHARMA",
        "name": "Apex Pharmaceuticals Industrial Unit",
        "org_type": "factory_company",
        "contact_email": "f.yasmin@apexpharma.com",
        "contact_phone": "+880-1912-456789",
        "authorized_representative": "Dr. Farhana Yasmin",
        "representative_role": "EHS Lead Officer",
        "address": "Plot 30-32, Sector 3, Dhaka EPZ",
        "status": "active",
        "created_at": "2026-03-01T11:00:00Z",
        "updated_at": "2026-10-18T16:00:00Z",
    },
    {
        "id": "ORG-CLEAN-SVC",
        "name": "CleanCare Industrial Vector & Environmental Services",
        "org_type": "contractor",
        "contact_email": "m.alam@cleancare.bd",
        "contact_phone": "+880-1715-567890",
        "authorized_representative": "Mahbub Alam",
        "representative_role": "Managing Director",
        "address": "Suite 4B, EPZ Commercial Tower, Savar",
        "status": "active",
        "created_at": "2026-01-20T08:30:00Z",
        "updated_at": "2026-09-20T10:00:00Z",
    },
    {
        "id": "ORG-SONAR-TECH",
        "name": "Sonargaon Tech Industries Ltd.",
        "org_type": "factory_company",
        "contact_email": "k.uddin@sonartech.com",
        "contact_phone": "+880-1611-678901",
        "authorized_representative": "Kamal Uddin",
        "representative_role": "Plant General Manager",
        "address": "Plot 40-42, Sector 3, Dhaka EPZ",
        "status": "active",
        "created_at": "2026-04-10T14:00:00Z",
        "updated_at": "2026-10-10T12:00:00Z",
    },
]

COORDINATION_GROUPS = [
    {
        "id": "GRP-EPZ-01",
        "name": "Dhaka EPZ Sector 3 — Dengue Prevention Consortium",
        "group_type": "industrial_park",
        "managing_org_id": "ORG-EPZ-MGMT",
        "description": "Multi-tenant vector prevention alliance coordinating joint drainage maintenance, synchronized larviciding, and shared perimeter boundary inspections across Sector 3 manufacturing facilities.",
        "geographic_scope": "Dhaka EPZ Sector 3 Corridor (Plots 10 through 45, 120 hectares)",
        "boundary_geojson": json.dumps({
            "type": "Polygon",
            "coordinates": [[
                [90.3640, 23.8010],
                [90.3720, 23.8015],
                [90.3735, 23.8090],
                [90.3650, 23.8085],
                [90.3640, 23.8010]
            ]]
        }),
        "coordinator_name": "Engr. Tariqul Islam",
        "coordinator_contact": "+880-1711-009988",
        "participation_rules": "1. Mandatory joint inspection of shared drainage per bi-weekly schedule. 2. 48-hour response for boundary spillover handoffs. 3. Full privacy isolation of internal production photos and corporate repair expenditure.",
        "status": "active",
        "created_at": "2026-03-01T09:00:00Z",
        "updated_at": "2026-10-20T10:00:00Z",
    }
]

GROUP_MEMBERSHIPS = [
    {
        "id": "MEM-001",
        "group_id": "GRP-EPZ-01",
        "organization_id": "ORG-EPZ-MGMT",
        "role": "managing_lead",
        "status": "active",
        "joined_at": "2026-03-01T09:00:00Z",
        "withdrawn_at": None,
        "withdrawal_reason": None,
        "authorized_by": "Engr. Tariqul Islam",
        "notes": "Consortium founder and estate managing authority",
        "created_at": "2026-03-01T09:00:00Z",
    },
    {
        "id": "MEM-002",
        "group_id": "GRP-EPZ-01",
        "organization_id": "ORG-BENGAL-APP",
        "role": "participating_member",
        "status": "active",
        "joined_at": "2026-03-05T10:30:00Z",
        "withdrawn_at": None,
        "withdrawal_reason": None,
        "authorized_by": "Nasreen Akhter",
        "notes": "Apparel facility with western perimeter boundary drain",
        "created_at": "2026-03-05T10:30:00Z",
    },
    {
        "id": "MEM-003",
        "group_id": "GRP-EPZ-01",
        "organization_id": "ORG-DELTA-MFG",
        "role": "participating_member",
        "status": "active",
        "joined_at": "2026-03-08T14:15:00Z",
        "withdrawn_at": None,
        "withdrawal_reason": None,
        "authorized_by": "Rafiqul Hasan",
        "notes": "Precision engineering plant with central courtyard access",
        "created_at": "2026-03-08T14:15:00Z",
    },
    {
        "id": "MEM-004",
        "group_id": "GRP-EPZ-01",
        "organization_id": "ORG-APEX-PHARMA",
        "role": "participating_member",
        "status": "active",
        "joined_at": "2026-03-12T11:45:00Z",
        "withdrawn_at": None,
        "withdrawal_reason": None,
        "authorized_by": "Dr. Farhana Yasmin",
        "notes": "Pharmaceutical manufacturing unit requiring strict vector sterility",
        "created_at": "2026-03-12T11:45:00Z",
    },
    {
        "id": "MEM-005",
        "group_id": "GRP-EPZ-01",
        "organization_id": "ORG-CLEAN-SVC",
        "role": "shared_contractor",
        "status": "active",
        "joined_at": "2026-03-15T09:00:00Z",
        "withdrawn_at": None,
        "withdrawal_reason": None,
        "authorized_by": "Mahbub Alam",
        "notes": "Consortium-contracted certified vector abatement team",
        "created_at": "2026-03-15T09:00:00Z",
    },
]

GROUP_INVITATIONS = [
    {
        "id": "INV-EPZ-2026-01",
        "group_id": "GRP-EPZ-01",
        "invited_org_id": "ORG-SONAR-TECH",
        "inviting_org_id": "ORG-EPZ-MGMT",
        "invited_by_name": "Engr. Tariqul Islam",
        "invitation_token": "INV-TOK-SONAR-9921",
        "message": "Sector 3 management invites Sonargaon Tech to participate in the joint monsoon drainage vector control alliance.",
        "status": "pending",
        "invited_at": "2026-10-18T10:00:00Z",
        "expires_at": "2026-11-18T23:59:59Z",
        "decided_at": None,
        "decision_by_name": None,
        "decision_notes": None,
    },
    {
        "id": "INV-EPZ-2026-02",
        "group_id": "GRP-EPZ-01",
        "invited_org_id": "ORG-APEX-PHARMA",
        "inviting_org_id": "ORG-EPZ-MGMT",
        "invited_by_name": "Engr. Tariqul Islam",
        "invitation_token": "INV-TOK-APEX-4412",
        "message": "Invitation to join Sector 3 Dengue Prevention Consortium.",
        "status": "accepted",
        "invited_at": "2026-03-01T10:00:00Z",
        "expires_at": "2026-04-01T23:59:59Z",
        "decided_at": "2026-03-12T11:45:00Z",
        "decision_by_name": "Dr. Farhana Yasmin",
        "decision_notes": "Accepted on behalf of Apex Pharma board for EHS compliance.",
    },
]

SHARED_AREAS = [
    {
        "id": "SA-EPZ-DRAIN-01",
        "group_id": "GRP-EPZ-01",
        "name": "Central Stormwater Drainage Corridor (Sector 3)",
        "area_type": "drainage_corridor",
        "description": "Primary arterial open masonry culvert receiving stormwater runoff from Bengal Apparel, Delta Mfg, and central roads.",
        "latitude": 23.8052,
        "longitude": 90.3685,
        "boundary_geojson": json.dumps({
            "type": "LineString",
            "coordinates": [[90.3660, 23.8040], [90.3685, 23.8052], [90.3710, 23.8070]]
        }),
        "responsible_org_id": "ORG-EPZ-MGMT",
        "responsible_manager": "Engr. Tariqul Islam",
        "linked_location_id": "LOC-MIR-01",
        "visibility_classification": "consortium_shared",
        "status": "maintenance_required",
        "created_at": "2026-03-02T10:00:00Z",
        "updated_at": "2026-10-18T14:00:00Z",
    },
    {
        "id": "SA-EPZ-ROAD-02",
        "group_id": "GRP-EPZ-01",
        "name": "Perimeter Heavy Logistics Service Road & Gutters",
        "area_type": "service_road",
        "description": "Shared perimeter transit road between Sector 3 factories with concrete roadside curb drainage traps.",
        "latitude": 23.8065,
        "longitude": 90.3698,
        "boundary_geojson": None,
        "responsible_org_id": "ORG-EPZ-MGMT",
        "responsible_manager": "Kabir Hossain",
        "linked_location_id": "LOC-MIR-02",
        "visibility_classification": "consortium_shared",
        "status": "active",
        "created_at": "2026-03-02T11:00:00Z",
        "updated_at": "2026-10-01T09:30:00Z",
    },
    {
        "id": "SA-EPZ-WASTE-03",
        "group_id": "GRP-EPZ-01",
        "name": "Consortium Central Solid-Waste Staging Bay",
        "area_type": "waste_storage",
        "description": "Enclosed masonry waste depot used by all Sector 3 tenants prior to municipal transport.",
        "latitude": 23.8040,
        "longitude": 90.3670,
        "boundary_geojson": None,
        "responsible_org_id": "ORG-DELTA-MFG",
        "responsible_manager": "Rafiqul Hasan",
        "linked_location_id": "LOC-TEJ-01",
        "visibility_classification": "consortium_shared",
        "status": "active",
        "created_at": "2026-03-04T12:00:00Z",
        "updated_at": "2026-10-10T11:00:00Z",
    },
    {
        "id": "SA-EPZ-COURT-04",
        "group_id": "GRP-EPZ-01",
        "name": "Inter-Facility Truck Staging & Green Courtyard",
        "area_type": "courtyard",
        "description": "Paved staging square and grass buffer between plots 20 and 26. Boundary under joint survey.",
        "latitude": 23.8035,
        "longitude": 90.3662,
        "boundary_geojson": None,
        "responsible_org_id": None,  # Responsibility not assigned
        "responsible_manager": None,
        "linked_location_id": None,
        "visibility_classification": "consortium_shared",
        "status": "active",
        "created_at": "2026-03-10T14:00:00Z",
        "updated_at": "2026-10-19T10:00:00Z",
    },
]

RESPONSIBILITY_HANDOFFS = [
    {
        "id": "HO-2026-001",
        "group_id": "GRP-EPZ-01",
        "shared_area_id": "SA-EPZ-DRAIN-01",
        "work_order_id": "WO-2026-001",
        "issue_id": "ISS-MIR-01-01",
        "originating_org_id": "ORG-BENGAL-APP",
        "proposed_receiving_org_id": "ORG-EPZ-MGMT",
        "reason": "Subsurface masonry failure in boundary gutter causes backflow into factory compound from the industrial park main drain.",
        "boundary_evidence_summary": "Inspector verified backflow originates 1.8m outside Bengal Apparel boundary fence line in main arterial channel culvert.",
        "status": "accepted",
        "requested_by_name": "Nasreen Akhter",
        "requested_at": "2026-10-18T10:30:00Z",
        "reviewed_by_name": "Engr. Tariqul Islam",
        "reviewed_at": "2026-10-19T14:15:00Z",
        "review_decision_notes": "Accepted responsibility. Park engineering crew assigned to culvert clearing.",
        "created_at": "2026-10-18T10:30:00Z",
    },
    {
        "id": "HO-2026-002",
        "group_id": "GRP-EPZ-01",
        "shared_area_id": "SA-EPZ-COURT-04",
        "work_order_id": None,
        "issue_id": None,
        "originating_org_id": "ORG-DELTA-MFG",
        "proposed_receiving_org_id": "ORG-EPZ-MGMT",
        "reason": "Temporary logistics container storage created low-lying puddle near common boundary. Requesting EPZ authority take over grading.",
        "boundary_evidence_summary": "Puddle straddles common border between Plot 24 and internal EPZ access lane.",
        "status": "pending_review",
        "requested_by_name": "Rafiqul Hasan",
        "requested_at": "2026-10-21T09:00:00Z",
        "reviewed_by_name": None,
        "reviewed_at": None,
        "review_decision_notes": None,
        "created_at": "2026-10-21T09:00:00Z",
    },
]

DATA_SHARING_PERMISSIONS = [
    {
        "id": "PERM-001",
        "group_id": "GRP-EPZ-01",
        "source_org_id": "ORG-BENGAL-APP",
        "receiving_org_id": None,
        "information_category": "shared_area_status",
        "permitted_access_level": "operational_status",
        "sharing_purpose": "Allow consortium members to monitor boundary drain clearing progress.",
        "is_revoked": 0,
        "granted_by_name": "Nasreen Akhter",
        "granted_at": "2026-03-05T11:00:00Z",
        "expires_at": "2026-12-31T23:59:59Z",
        "revoked_by_name": None,
        "revoked_at": None,
        "revocation_reason": None,
    },
    {
        "id": "PERM-002",
        "group_id": "GRP-EPZ-01",
        "source_org_id": "ORG-DELTA-MFG",
        "receiving_org_id": None,
        "information_category": "reinspection_schedule",
        "permitted_access_level": "detailed_dates",
        "sharing_purpose": "Coordinate contractor spraying visits with EPZ bi-weekly schedule.",
        "is_revoked": 0,
        "granted_by_name": "Rafiqul Hasan",
        "granted_at": "2026-03-08T15:00:00Z",
        "expires_at": "2026-12-31T23:59:59Z",
        "revoked_by_name": None,
        "revoked_at": None,
        "revocation_reason": None,
    },
    {
        "id": "PERM-003",
        "group_id": "GRP-EPZ-01",
        "source_org_id": "ORG-APEX-PHARMA",
        "receiving_org_id": None,
        "information_category": "boundary_hazard_alert",
        "permitted_access_level": "summary_only",
        "sharing_purpose": "Notify park authority immediately if larvae discovered in shared stormwater sump.",
        "is_revoked": 0,
        "granted_by_name": "Dr. Farhana Yasmin",
        "granted_at": "2026-03-12T12:00:00Z",
        "expires_at": "2026-12-31T23:59:59Z",
        "revoked_by_name": None,
        "revoked_at": None,
        "revocation_reason": None,
    },
]

COORDINATION_MEETINGS = [
    {
        "id": "MTG-2026-01",
        "group_id": "GRP-EPZ-01",
        "meeting_title": "Monsoon Vector Preparedness & Shared Corridor Review",
        "meeting_date": "2026-10-15T11:00:00Z",
        "chairperson_name": "Engr. Tariqul Islam",
        "chairperson_org_id": "ORG-EPZ-MGMT",
        "attendees_json": json.dumps([
            {"org_id": "ORG-EPZ-MGMT", "name": "Engr. Tariqul Islam", "role": "Chairperson"},
            {"org_id": "ORG-BENGAL-APP", "name": "Nasreen Akhter", "role": "Member Rep"},
            {"org_id": "ORG-DELTA-MFG", "name": "Rafiqul Hasan", "role": "Member Rep"},
            {"org_id": "ORG-CLEAN-SVC", "name": "Mahbub Alam", "role": "Contractor Lead"}
        ]),
        "discussion_summary": "Reviewed bi-weekly shared drainage desilting. Confirmed CleanCare as consortium authorized contractor for common sectors. Agreed to test responsibility handoff workflow on boundary culvert.",
        "next_meeting_date": "2026-11-05",
        "created_at": "2026-10-15T13:00:00Z",
    }
]

COORDINATION_ACTION_ITEMS = [
    {
        "id": "ACT-001",
        "meeting_id": "MTG-2026-01",
        "group_id": "GRP-EPZ-01",
        "action_title": "Desilt main arterial culvert at Sector 3 drainage corridor",
        "description": "Clean silt build-up along 150m masonry channel to restore unimpeded flow during rainfall.",
        "assigned_org_id": "ORG-EPZ-MGMT",
        "assigned_lead_name": "Kabir Hossain",
        "due_date": "2026-10-28",
        "status": "in_progress",
        "linked_shared_area_id": "SA-EPZ-DRAIN-01",
        "linked_work_order_id": "WO-2026-001",
        "completion_notes": None,
        "completed_at": None,
        "created_at": "2026-10-15T13:15:00Z",
    },
    {
        "id": "ACT-002",
        "meeting_id": "MTG-2026-01",
        "group_id": "GRP-EPZ-01",
        "action_title": "Relocate scrap pallet storage away from common perimeter fence",
        "description": "Clear wood debris creating stagnant water pockets adjacent to shared logistics road.",
        "assigned_org_id": "ORG-DELTA-MFG",
        "assigned_lead_name": "Rafiqul Hasan",
        "due_date": "2026-10-25",
        "status": "completed",
        "linked_shared_area_id": None,
        "linked_work_order_id": None,
        "completion_notes": "Pallet storage moved to covered indoor bay. Verified by factory supervisor.",
        "completed_at": "2026-10-20T16:00:00Z",
        "created_at": "2026-10-15T13:20:00Z",
    },
    {
        "id": "ACT-003",
        "meeting_id": "MTG-2026-01",
        "group_id": "GRP-EPZ-01",
        "action_title": "Install fine mesh netting over central waste bay perimeter drains",
        "description": "Prevent discarded plastic bottles and trash from clogging runoff outlets.",
        "assigned_org_id": "ORG-CLEAN-SVC",
        "assigned_lead_name": "Mahbub Alam",
        "due_date": "2026-11-02",
        "status": "pending",
        "linked_shared_area_id": "SA-EPZ-WASTE-03",
        "linked_work_order_id": None,
        "completion_notes": None,
        "completed_at": None,
        "created_at": "2026-10-15T13:25:00Z",
    },
]

COORDINATION_AUDIT_LOGS = [
    {
        "id": "LOG-001",
        "group_id": "GRP-EPZ-01",
        "actor_name": "Engr. Tariqul Islam",
        "actor_org_id": "ORG-EPZ-MGMT",
        "action_type": "group_created",
        "target_entity_type": "coordination_group",
        "target_entity_id": "GRP-EPZ-01",
        "details_json": json.dumps({"group_name": "Dhaka EPZ Sector 3 — Dengue Prevention Consortium"}),
        "timestamp": "2026-03-01T09:00:00Z",
    },
    {
        "id": "LOG-002",
        "group_id": "GRP-EPZ-01",
        "actor_name": "Engr. Tariqul Islam",
        "actor_org_id": "ORG-EPZ-MGMT",
        "action_type": "invitation_sent",
        "target_entity_type": "group_invitation",
        "target_entity_id": "INV-EPZ-2026-01",
        "details_json": json.dumps({"invited_org": "ORG-SONAR-TECH"}),
        "timestamp": "2026-10-18T10:00:00Z",
    },
    {
        "id": "LOG-003",
        "group_id": "GRP-EPZ-01",
        "actor_name": "Nasreen Akhter",
        "actor_org_id": "ORG-BENGAL-APP",
        "action_type": "handoff_requested",
        "target_entity_type": "responsibility_handoff",
        "target_entity_id": "HO-2026-001",
        "details_json": json.dumps({"proposed_org": "ORG-EPZ-MGMT", "reason": "Subsurface masonry failure"}),
        "timestamp": "2026-10-18T10:30:00Z",
    },
    {
        "id": "LOG-004",
        "group_id": "GRP-EPZ-01",
        "actor_name": "Engr. Tariqul Islam",
        "actor_org_id": "ORG-EPZ-MGMT",
        "action_type": "handoff_accepted",
        "target_entity_type": "responsibility_handoff",
        "target_entity_id": "HO-2026-001",
        "details_json": json.dumps({"accepted_by": "Engr. Tariqul Islam"}),
        "timestamp": "2026-10-19T14:15:00Z",
    },
]


async def seed_coordination_if_empty(session: AsyncSession):
    # Check if organizations exist
    check = await session.execute(text("SELECT count(*) FROM organizations"))
    if (check.scalar() or 0) > 0:
        return

    # 1. Insert organizations
    for org in ORGANIZATIONS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO organizations
                (id, name, org_type, contact_email, contact_phone, authorized_representative,
                 representative_role, address, status, created_at, updated_at)
                VALUES
                (:id, :name, :org_type, :contact_email, :contact_phone, :authorized_representative,
                 :representative_role, :address, :status, :created_at, :updated_at)
            """),
            org
        )

    # 2. Update existing properties with organization_id
    prop_org_map = {
        "PROP-MIR-01": "ORG-BENGAL-APP",
        "PROP-TEJ-01": "ORG-DELTA-MFG",
        "PROP-MOH-01": "ORG-APEX-PHARMA",
    }
    for prop_id, org_id in prop_org_map.items():
        await session.execute(
            text("UPDATE properties SET organization_id = :org_id WHERE id = :prop_id"),
            {"org_id": org_id, "prop_id": prop_id}
        )

    # 3. Insert coordination groups
    for grp in COORDINATION_GROUPS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO coordination_groups
                (id, name, group_type, managing_org_id, description, geographic_scope,
                 boundary_geojson, coordinator_name, coordinator_contact, participation_rules,
                 status, created_at, updated_at)
                VALUES
                (:id, :name, :group_type, :managing_org_id, :description, :geographic_scope,
                 :boundary_geojson, :coordinator_name, :coordinator_contact, :participation_rules,
                 :status, :created_at, :updated_at)
            """),
            grp
        )

    # 4. Insert memberships
    for mem in GROUP_MEMBERSHIPS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO group_memberships
                (id, group_id, organization_id, role, status, joined_at, withdrawn_at,
                 withdrawal_reason, authorized_by, notes, created_at)
                VALUES
                (:id, :group_id, :organization_id, :role, :status, :joined_at, :withdrawn_at,
                 :withdrawal_reason, :authorized_by, :notes, :created_at)
            """),
            mem
        )

    # 5. Insert invitations
    for inv in GROUP_INVITATIONS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO group_invitations
                (id, group_id, invited_org_id, inviting_org_id, invited_by_name, invitation_token,
                 message, status, invited_at, expires_at, decided_at, decision_by_name, decision_notes)
                VALUES
                (:id, :group_id, :invited_org_id, :inviting_org_id, :invited_by_name, :invitation_token,
                 :message, :status, :invited_at, :expires_at, :decided_at, :decision_by_name, :decision_notes)
            """),
            inv
        )

    # 6. Insert shared areas
    for sa in SHARED_AREAS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO shared_areas
                (id, group_id, name, area_type, description, latitude, longitude,
                 boundary_geojson, responsible_org_id, responsible_manager, linked_location_id,
                 visibility_classification, status, created_at, updated_at)
                VALUES
                (:id, :group_id, :name, :area_type, :description, :latitude, :longitude,
                 :boundary_geojson, :responsible_org_id, :responsible_manager, :linked_location_id,
                 :visibility_classification, :status, :created_at, :updated_at)
            """),
            sa
        )

    # 7. Insert responsibility handoffs
    for ho in RESPONSIBILITY_HANDOFFS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO responsibility_handoffs
                (id, group_id, shared_area_id, work_order_id, issue_id, originating_org_id,
                 proposed_receiving_org_id, reason, boundary_evidence_summary, status,
                 requested_by_name, requested_at, reviewed_by_name, reviewed_at,
                 review_decision_notes, created_at)
                VALUES
                (:id, :group_id, :shared_area_id, :work_order_id, :issue_id, :originating_org_id,
                 :proposed_receiving_org_id, :reason, :boundary_evidence_summary, :status,
                 :requested_by_name, :requested_at, :reviewed_by_name, :reviewed_at,
                 :review_decision_notes, :created_at)
            """),
            ho
        )

    # 8. Insert data sharing permissions
    for perm in DATA_SHARING_PERMISSIONS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO data_sharing_permissions
                (id, group_id, source_org_id, receiving_org_id, information_category,
                 permitted_access_level, sharing_purpose, is_revoked, granted_by_name,
                 granted_at, expires_at, revoked_by_name, revoked_at, revocation_reason)
                VALUES
                (:id, :group_id, :source_org_id, :receiving_org_id, :information_category,
                 :permitted_access_level, :sharing_purpose, :is_revoked, :granted_by_name,
                 :granted_at, :expires_at, :revoked_by_name, :revoked_at, :revocation_reason)
            """),
            perm
        )

    # 9. Insert coordination meetings
    for mtg in COORDINATION_MEETINGS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO coordination_meetings
                (id, group_id, meeting_title, meeting_date, chairperson_name, chairperson_org_id,
                 attendees_json, discussion_summary, next_meeting_date, created_at)
                VALUES
                (:id, :group_id, :meeting_title, :meeting_date, :chairperson_name, :chairperson_org_id,
                 :attendees_json, :discussion_summary, :next_meeting_date, :created_at)
            """),
            mtg
        )

    # 10. Insert action items
    for act in COORDINATION_ACTION_ITEMS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO coordination_action_items
                (id, meeting_id, group_id, action_title, description, assigned_org_id,
                 assigned_lead_name, due_date, status, linked_shared_area_id,
                 linked_work_order_id, completion_notes, completed_at, created_at)
                VALUES
                (:id, :meeting_id, :group_id, :action_title, :description, :assigned_org_id,
                 :assigned_lead_name, :due_date, :status, :linked_shared_area_id,
                 :linked_work_order_id, :completion_notes, :completed_at, :created_at)
            """),
            act
        )

    # 11. Insert audit logs
    for log in COORDINATION_AUDIT_LOGS:
        await session.execute(
            text("""
                INSERT OR IGNORE INTO coordination_audit_logs
                (id, group_id, actor_name, actor_org_id, action_type, target_entity_type,
                 target_entity_id, details_json, timestamp)
                VALUES
                (:id, :group_id, :actor_name, :actor_org_id, :action_type, :target_entity_type,
                 :target_entity_id, :details_json, :timestamp)
            """),
            log
        )

    # 12. Update existing work order with group reference
    await session.execute(
        text("""
            UPDATE service_work_orders
            SET coordination_group_id = 'GRP-EPZ-01', shared_area_id = 'SA-EPZ-DRAIN-01'
            WHERE id = 'WO-2026-001'
        """)
    )

    await session.commit()
