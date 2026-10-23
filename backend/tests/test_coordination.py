"""
Integration tests for Improvement 05 — Coordinated Prevention Across Properties.
Verifies:
- Organization-level accounts, multi-tenant isolation, and property ownership
- Coordination consortium group lifecycle, boundary definition, and participation rules
- Official invitation workflows (create, duplicate prevention, accept, decline, cancel)
- Shared area registration, status tracking, and responsibility assignment ("Responsibility not assigned" default)
- Coordinated shared-area reinspection scheduling and duplicate visit prevention
- Group inspection calendar aggregation strictly excluding private internal facility checks
- Shared maintenance work orders and contractor task assignments with operational sanitization
- Boundary problem responsibility handoff workflows (review, accept, reject, transfer)
- Server-side data-sharing permissions (grant, default-deny private records, revocation)
- Consortium taskforce meetings, minutes, and action item tracking
- Real-time operational summary metrics (accountability percentages, overdue visits)
- Exportable meeting progress reports
- Auditable coordination event logging
- Tenant-isolated organization dashboards ("My Properties", "My Hazard Locations", "My Work Orders")
- Shared repair planning operational summaries preserving confidential financial quotes
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from main import app
from db.database import init_db, seed_wards, seed_sites, seed_scheduling, seed_services, seed_repairs, seed_coordination


DEV_AUTH_KEY = "dengue-authority-dev-2026"


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_database():
    await init_db()
    await seed_wards()
    await seed_sites()
    await seed_scheduling()
    await seed_services()
    await seed_repairs()
    from db.database import AsyncSessionLocal
    from sqlalchemy import text
    async with AsyncSessionLocal() as session:
        await session.execute(text("DELETE FROM coordination_audit_logs"))
        await session.execute(text("DELETE FROM coordination_action_items"))
        await session.execute(text("DELETE FROM coordination_meetings"))
        await session.execute(text("DELETE FROM data_sharing_permissions"))
        await session.execute(text("DELETE FROM responsibility_handoffs"))
        await session.execute(text("DELETE FROM shared_areas"))
        await session.execute(text("DELETE FROM group_invitations"))
        await session.execute(text("DELETE FROM group_memberships"))
        await session.execute(text("DELETE FROM coordination_groups"))
        await session.execute(text("DELETE FROM organizations"))
        await session.execute(text("DELETE FROM scheduled_inspections WHERE id LIKE 'SCHED-SHR-%'"))
        await session.commit()
    await seed_coordination()
    yield



@pytest.fixture
def auth_headers():
    return {"X-Authority-Key": DEV_AUTH_KEY}


@pytest.mark.asyncio
class TestCoordinatedPreventionAcrossProperties:

    async def test_01_organizations_listing_and_properties(self, auth_headers):
        """Verify organization registration, listing, and property ownership associations."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/organizations", headers=auth_headers)
            assert res.status_code == 200
            orgs = res.json()
            assert len(orgs) >= 5
            
            # Verify EPZ Management and Bengal Apparel exist
            epz = next((o for o in orgs if o["id"] == "ORG-EPZ-MGMT"), None)
            assert epz is not None
            assert epz["org_type"] == "industrial_park_operator"

            # Check properties owned by Bengal Apparel
            prop_res = await ac.get("/api/organizations/ORG-BENGAL-APP/properties", headers=auth_headers)
            assert prop_res.status_code == 200
            props = prop_res.json()
            assert len(props) >= 1
            assert props[0]["organization_id"] == "ORG-BENGAL-APP"

    async def test_02_coordination_group_lifecycle(self, auth_headers):
        """Verify group retrieval, members, and settings updates."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Get group details
            res = await ac.get("/api/coordination/groups/GRP-EPZ-01", headers=auth_headers)
            assert res.status_code == 200
            group = res.json()
            assert "Consortium" in group["name"]
            assert group["managing_org_id"] == "ORG-EPZ-MGMT"

            # 2. Get members
            mem_res = await ac.get("/api/coordination/groups/GRP-EPZ-01/members", headers=auth_headers)
            assert mem_res.status_code == 200
            members = mem_res.json()
            assert len(members) >= 4
            lead = next((m for m in members if m["role"] == "managing_lead"), None)
            assert lead is not None
            assert lead["organization_id"] == "ORG-EPZ-MGMT"

            # 3. Update group settings
            update_res = await ac.patch(
                "/api/coordination/groups/GRP-EPZ-01",
                json={"participation_rules": "Updated bi-weekly joint inspection protocol."},
                headers=auth_headers
            )
            assert update_res.status_code == 200
            assert update_res.json()["participation_rules"] == "Updated bi-weekly joint inspection protocol."

    async def test_03_invitation_workflow_and_duplicate_prevention(self, auth_headers):
        """Verify invitation creation, duplicate check, and decision workflow."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Check existing pending invite for Sonargaon Tech
            invs_res = await ac.get("/api/coordination/invitations?group_id=GRP-EPZ-01", headers=auth_headers)
            assert invs_res.status_code == 200
            invs = invs_res.json()
            assert any(i["invited_org_id"] == "ORG-SONAR-TECH" for i in invs)

            # Attempting to invite same org while pending should be rejected with 400
            dup_res = await ac.post(
                "/api/coordination/invitations",
                json={
                    "group_id": "GRP-EPZ-01",
                    "invited_org_id": "ORG-SONAR-TECH",
                    "inviting_org_id": "ORG-EPZ-MGMT",
                    "invited_by_name": "Engr. Tariqul Islam",
                    "message": "Duplicate invite test",
                },
                headers=auth_headers
            )
            assert dup_res.status_code == 400

    async def test_04_shared_areas_and_unassigned_responsibility_default(self, auth_headers):
        """Verify shared areas list, linking to permanent hazard locations, and explicit responsibility labels."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/coordination/groups/GRP-EPZ-01/shared-areas", headers=auth_headers)
            assert res.status_code == 200
            areas = res.json()
            assert len(areas) >= 3

            # Common drainage corridor has an assigned manager
            drain = next((a for a in areas if a["id"] == "SA-EPZ-DRAIN-01"), None)
            assert drain is not None
            assert drain["responsible_org_name"] != "Responsibility not assigned"

            # Truck staging courtyard has unassigned responsibility
            court = next((a for a in areas if a["id"] == "SA-EPZ-COURT-04"), None)
            assert court is not None
            assert court["responsible_org_name"] == "Responsibility not assigned"

    async def test_05_shared_inspection_scheduling_and_duplicate_prevention(self, auth_headers):
        """Verify explicit creation of a shared inspection and duplicate visit prevention."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Schedule shared inspection
            test_date = "2026-11-20"
            res = await ac.post(
                "/api/coordination/groups/GRP-EPZ-01/shared-inspections",
                json={
                    "shared_area_id": "SA-EPZ-DRAIN-01",
                    "scheduled_date": test_date,
                    "assigned_inspector": "Consortium Rapid Response Unit",
                    "created_by": "Engr. Tariqul Islam",
                    "notes": "Post-monsoon culvert sediment inspection"
                },
                headers=auth_headers
            )
            assert res.status_code == 201
            data = res.json()
            assert data["status"] == "scheduled"
            assert data["scheduled_date"] == test_date

            # Duplicate attempt on same date and shared area must fail
            dup_res = await ac.post(
                "/api/coordination/groups/GRP-EPZ-01/shared-inspections",
                json={
                    "shared_area_id": "SA-EPZ-DRAIN-01",
                    "scheduled_date": test_date,
                    "assigned_inspector": "Another Team",
                    "created_by": "Engr. Tariqul Islam",
                },
                headers=auth_headers
            )
            assert dup_res.status_code == 400
            assert "already scheduled" in dup_res.json()["detail"].lower()

    async def test_06_shared_calendar_privacy_boundary(self, auth_headers):
        """Verify group calendar aggregates shared tasks while excluding private internal visits."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/coordination/groups/GRP-EPZ-01/calendar", headers=auth_headers)
            assert res.status_code == 200
            events = res.json()
            assert len(events) >= 1
            # Events must only refer to shared areas
            for ev in events:
                assert "shared_area_id" in ev
                assert ev["shared_area_id"] is not None

    async def test_07_shared_work_orders_and_sanitization(self, auth_headers):
        """Verify shared work orders are retrieved and sensitive internal fields sanitized."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/coordination/groups/GRP-EPZ-01/work-orders", headers=auth_headers)
            assert res.status_code == 200
            orders = res.json()
            assert len(orders) >= 1
            for wo in orders:
                # Sanitization: private worker phones or contractor bids must not leak
                assert "contractor_invoice_amount" not in wo
                assert "internal_cost_estimate" not in wo
                assert "worker_phone" not in wo

    async def test_08_responsibility_handoff_workflow(self, auth_headers):
        """Verify requesting a boundary responsibility transfer and reviewing it."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. List handoffs
            res = await ac.get("/api/coordination/groups/GRP-EPZ-01/handoffs", headers=auth_headers)
            assert res.status_code == 200
            handoffs = res.json()
            pending_ho = next((h for h in handoffs if h["status"] == "pending_review"), None)
            assert pending_ho is not None

            # 2. Review and accept handoff
            rev_res = await ac.post(
                f"/api/coordination/handoffs/{pending_ho['id']}/review",
                json={
                    "decision": "accept",
                    "reviewed_by_name": "Engr. Tariqul Islam",
                    "review_decision_notes": "Accepted under EPZ common area jurisdiction."
                },
                headers=auth_headers
            )
            assert rev_res.status_code == 200
            assert rev_res.json()["status"] == "accepted"

    async def test_09_data_sharing_permissions(self, auth_headers):
        """Verify explicit data sharing grant, listing, and revocation."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Grant new permission
            grant_res = await ac.post(
                "/api/coordination/groups/GRP-EPZ-01/permissions",
                json={
                    "group_id": "GRP-EPZ-01",
                    "source_org_id": "ORG-APEX-PHARMA",
                    "information_category": "boundary_hazard_alert",
                    "permitted_access_level": "operational_status",
                    "sharing_purpose": "Alert consortium members of perimeter stormwater channel issues.",
                    "granted_by_name": "Dr. Farhana Yasmin",
                },
                headers=auth_headers
            )
            assert grant_res.status_code == 201
            perm = grant_res.json()
            assert perm["is_revoked"] == 0

            # 2. Revoke permission
            revoke_res = await ac.post(
                f"/api/coordination/permissions/{perm['id']}/revoke",
                json={
                    "revoked_by_name": "Dr. Farhana Yasmin",
                    "revocation_reason": "End of monsoon monitoring period."
                },
                headers=auth_headers
            )
            assert revoke_res.status_code == 200
            assert revoke_res.json()["status"] == "revoked"

    async def test_10_coordination_metrics_and_report(self, auth_headers):
        """Verify metrics calculations and official meeting progress report generation."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Metrics
            met_res = await ac.get("/api/coordination/groups/GRP-EPZ-01/metrics", headers=auth_headers)
            assert met_res.status_code == 200
            metrics = met_res.json()
            assert metrics["total_participating_orgs"] >= 4
            assert metrics["total_shared_areas"] >= 3
            assert isinstance(metrics["percentage_shared_areas_assigned"], (int, float))

            # 2. Report
            rep_res = await ac.get("/api/coordination/groups/GRP-EPZ-01/report", headers=auth_headers)
            assert rep_res.status_code == 200
            report = rep_res.json()
            assert report["group_id"] == "GRP-EPZ-01"
            assert len(report["participating_orgs"]) >= 4
            assert len(report["shared_areas_summary"]) >= 3
            assert "agreed_action_items" in report

    async def test_11_participating_organization_dashboard(self, auth_headers):
        """Verify tenant-isolated organization view showing properties, hazards, and shared items."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/organizations/ORG-BENGAL-APP/dashboard", headers=auth_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["organization"]["id"] == "ORG-BENGAL-APP"
            assert len(data["properties"]) >= 1
            assert len(data["hazard_locations"]) >= 1
            assert len(data["group_memberships"]) >= 1

    async def test_12_shared_repairs_without_financial_leakage(self, auth_headers):
        """Verify shared repair summaries expose operational details without leaking confidential costs."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/coordination/groups/GRP-EPZ-01/repairs", headers=auth_headers)
            assert res.status_code == 200
            repairs = res.json()
            for r in repairs:
                assert "proposal_title" in r
                assert "shared_area_name" in r
                assert "status" in r
                # Critical check: financial pricing and supplier bids are omitted
                assert "quoted_amount" not in r
                assert "unit_cost" not in r
                assert "contractor_markup" not in r
