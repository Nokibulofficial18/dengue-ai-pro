import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from db.database import init_db, seed_wards, seed_sites, AsyncSessionLocal
from sqlalchemy import text


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_database():
    await init_db()
    await seed_wards()
    await seed_sites()
    yield


@pytest.mark.asyncio
async def test_full_hazard_registry_workflow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # -------------------------------------------------------------
        # 1. Test unauthorized access fails (HTTP 401)
        # -------------------------------------------------------------
        res_unauth = await client.get("/api/sites/properties")
        assert res_unauth.status_code == 401, "Protected sites endpoint must return 401 when unauthorized"

        # -------------------------------------------------------------
        # 2. Test authority authentication (valid & invalid)
        # -------------------------------------------------------------
        bad_login = await client.post("/api/authority/login", json={"username": "wrong", "password": "wrong"})
        assert bad_login.status_code == 401

        login_res = await client.post(
            "/api/authority/login",
            json={"username": "authority", "password": "dengue2026"},
        )
        assert login_res.status_code == 200
        login_data = login_res.json()
        token = login_data["token"]
        assert token.startswith("auth_")

        headers = {"Authorization": f"Bearer {token}"}

        # Verify /api/authority/me
        me_res = await client.get("/api/authority/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["role"] == "authority_officer"

        # -------------------------------------------------------------
        # 3. Create a Property (Feature A)
        # -------------------------------------------------------------
        # Test invalid ward returns 400
        invalid_prop = await client.post(
            "/api/sites/properties",
            headers=headers,
            json={
                "name": "Invalid Ward Building",
                "property_type": "office_building",
                "ward_id": "NON-EXISTENT-WARD",
                "address": "Random road Dhaka",
            },
        )
        assert invalid_prop.status_code == 400

        prop_res = await client.post(
            "/api/sites/properties",
            headers=headers,
            json={
                "name": "Apex Footwear Industrial Complex",
                "property_type": "industrial_facility",
                "ward_id": "DHK-001",
                "address": "Plot 55-58, Sector 12, Mirpur, Dhaka",
                "latitude": 23.8240,
                "longitude": 90.3660,
                "responsible_org": "Apex Enterprise Ltd.",
                "manager_name": "K. M. Ashraful",
                "manager_contact": "+880 1711-998877",
            },
        )
        assert prop_res.status_code == 201, prop_res.text
        prop = prop_res.json()
        prop_id = prop["id"]
        assert prop["name"] == "Apex Footwear Industrial Complex"
        assert prop["status"] == "active"

        # -------------------------------------------------------------
        # 4. Register two hazard locations inside property (Feature B)
        # -------------------------------------------------------------
        loc1_res = await client.post(
            f"/api/sites/properties/{prop_id}/locations",
            headers=headers,
            json={
                "location_code": "APEX-ROOF-DRAIN-01",
                "name": "Main Tannery Roof Drain East",
                "category": "roof_drain",
                "floor_zone": "Building A - Roof Level East",
                "written_directions": "Use stairwell 1, proceed 15m east near water tank.",
                "description": "Perimeter roof drainage trough vulnerable to debris clogging.",
            },
        )
        assert loc1_res.status_code == 201
        loc1 = loc1_res.json()
        loc1_id = loc1["id"]
        assert loc1["location_code"] == "APEX-ROOF-DRAIN-01"

        # Test duplicate code in same property returns 400
        dup_res = await client.post(
            f"/api/sites/properties/{prop_id}/locations",
            headers=headers,
            json={
                "location_code": "APEX-ROOF-DRAIN-01",
                "name": "Duplicate Code Try",
                "category": "roof_drain",
            },
        )
        assert dup_res.status_code == 400

        loc2_res = await client.post(
            f"/api/sites/properties/{prop_id}/locations",
            headers=headers,
            json={
                "location_code": "APEX-BASEMENT-PIT-02",
                "name": "Boiler Room Drainage Pit",
                "category": "basement_drain",
                "floor_zone": "Basement Sub-level 1",
                "written_directions": "Enter boiler room south door, pit is in northwest corner.",
                "description": "Underground pump sump collecting wastewater runoff.",
            },
        )
        assert loc2_res.status_code == 201
        loc2 = loc2_res.json()
        loc2_id = loc2["id"]

        # List locations for this property
        prop_locs = await client.get(f"/api/sites/locations?property_id={prop_id}", headers=headers)
        assert prop_locs.status_code == 200
        assert len(prop_locs.json()) == 2

        # -------------------------------------------------------------
        # 5. Record an inspection for the first location (Feature C)
        # -------------------------------------------------------------
        insp1_res = await client.post(
            f"/api/sites/locations/{loc1_id}/inspections",
            headers=headers,
            json={
                "inspector_name": "Inspector Kabir",
                "inspector_role": "DNCC Field Officer",
                "result": "problem_found",
                "notes": "3 inches of stagnant murky water pooling behind clogged leaf strainer.",
                "evidence_notes": "Larvae movement observed in pooled rainwater.",
                "problem_identified": "Stagnant rainwater pooling & active mosquito breeding",
                "weather_conditions": "Humid, 32C, rained 18 hours prior",
                "create_issue": True,
                "issue_type": "standing_water",
                "issue_severity": "high",
                "issue_description": "Extensive standing water with active vector breeding in roof drain.",
            },
        )
        assert insp1_res.status_code == 201
        insp1 = insp1_res.json()
        assert insp1["result"] == "problem_found"
        assert "safety_disclaimer" in insp1

        # Check that issue was created
        issues1_res = await client.get(f"/api/sites/locations/{loc1_id}/issues", headers=headers)
        assert issues1_res.status_code == 200
        issues1 = issues1_res.json()
        assert len(issues1) == 1
        issue1 = issues1[0]
        issue1_id = issue1["id"]
        assert issue1["status"] == "open"

        # -------------------------------------------------------------
        # 6. Record a maintenance action (Feature D)
        # -------------------------------------------------------------
        act_res = await client.post(
            f"/api/sites/locations/{loc1_id}/activities",
            headers=headers,
            json={
                "issue_id": issue1_id,
                "activity_type": "cleaning",
                "performed_by": "Apex Facility Caretaker Jahir",
                "notes": "Debris and sludge cleared from drain grate; 500ml larvicide applied.",
            },
        )
        assert act_res.status_code == 201
        act = act_res.json()
        assert act["activity_type"] == "cleaning"

        # -------------------------------------------------------------
        # 7. Resolve the issue (Feature D)
        # -------------------------------------------------------------
        res_issue = await client.post(
            f"/api/sites/issues/{issue1_id}/resolve",
            headers=headers,
            json={
                "resolution_notes": "Obstruction removed and site cleared of all stagnant water. Outflow unobstructed.",
                "resolved_by": "Inspector Kabir",
            },
        )
        assert res_issue.status_code == 200
        resolved_issue = res_issue.json()
        assert resolved_issue["status"] == "resolved"
        assert resolved_issue["resolved_at"] is not None

        # Record a clear inspection after resolution
        insp_clear_res = await client.post(
            f"/api/sites/locations/{loc1_id}/inspections",
            headers=headers,
            json={
                "inspector_name": "Inspector Kabir",
                "inspector_role": "DNCC Field Officer",
                "result": "clear",
                "notes": "Post-treatment check. Drain is dry and clean.",
            },
        )
        assert insp_clear_res.status_code == 201
        assert "safety_disclaimer" in insp_clear_res.json()

        # -------------------------------------------------------------
        # 8. Later inspection & recurring issue identification (Feature G)
        # -------------------------------------------------------------
        insp2_res = await client.post(
            f"/api/sites/locations/{loc1_id}/inspections",
            headers=headers,
            json={
                "inspector_name": "Inspector Kabir",
                "inspector_role": "DNCC Field Officer",
                "result": "problem_found",
                "notes": "Water returned to same drain trough after overnight rain.",
                "problem_identified": "Recurrent water pooling due to low gutter slope",
            },
        )
        assert insp2_res.status_code == 201

        # Create new issue
        issue2_res = await client.post(
            f"/api/sites/locations/{loc1_id}/issues",
            headers=headers,
            json={
                "issue_type": "standing_water",
                "description": "Standing water returned to East roof drain; slope gradient prevents complete runoff.",
                "severity": "high",
            },
        )
        assert issue2_res.status_code == 201
        issue2 = issue2_res.json()
        issue2_id = issue2["id"]
        assert issue2["is_recurrence"] == 0

        # Confirm recurrence linking to earlier resolved issue1
        rec_res = await client.post(
            f"/api/sites/issues/{issue2_id}/confirm-recurrence",
            headers=headers,
            json={
                "previous_issue_id": issue1_id,
                "confirmed_by": "Inspector Kabir (Supervisor Approval)",
                "notes": "Confirmed recurrence: same drainage defect returned following temporary clearing.",
            },
        )
        assert rec_res.status_code == 200
        rec_data = rec_res.json()
        assert rec_data["is_recurrence"] == 1
        assert rec_data["previous_issue_id"] == issue1_id
        assert rec_data["recurrence_confirmed_by"] is not None

        # -------------------------------------------------------------
        # 9. Retrieve the complete timeline (Feature F)
        # -------------------------------------------------------------
        timeline_res = await client.get(f"/api/sites/locations/{loc1_id}/timeline", headers=headers)
        assert timeline_res.status_code == 200
        timeline = timeline_res.json()
        assert "location" in timeline
        assert "events" in timeline
        events = timeline["events"]
        # Verify event types are populated from real db records
        event_types = {e["event_type"] for e in events}
        assert "registration" in event_types
        assert "inspection" in event_types
        assert "issue_reported" in event_types
        assert "issue_resolved" in event_types
        assert "activity" in event_types
        assert len(events) >= 5

        # -------------------------------------------------------------
        # 10. Check recurring locations aggregation endpoint (Feature G)
        # -------------------------------------------------------------
        rec_list_res = await client.get("/api/sites/locations/recurring?days=90", headers=headers)
        assert rec_list_res.status_code == 200
        rec_list = rec_list_res.json()
        target_rec = next((item for item in rec_list if item["location_id"] == loc1_id), None)
        assert target_rec is not None, "Newly confirmed recurring location must appear in recurring list"
        assert target_rec["repeat_count_90d"] >= 1
        assert "confirmed recurring problem" in target_rec["summary_statement"]

        # -------------------------------------------------------------
        # 11. Associate an existing citizen report with location (Feature E)
        # -------------------------------------------------------------
        # Insert a raw test citizen report
        async with AsyncSessionLocal() as session:
            await session.execute(
                text(
                    """
                    INSERT INTO citizen_reports (ward_id, photo_path, yolo_confidence, verified, points_awarded, submitted_at)
                    VALUES ('DHK-001', 'uploads/test_citizen_report.jpg', 0.90, 1, 10, '2026-10-21T10:00:00Z')
                    """
                )
            )
            await session.commit()
            test_report_id = (
                await session.execute(text("SELECT id FROM citizen_reports ORDER BY id DESC LIMIT 1"))
            ).scalar_one()

        # Check listing of citizen reports
        cr_list = await client.get("/api/sites/citizen-reports?ward_id=DHK-001", headers=headers)
        assert cr_list.status_code == 200
        rep_entry = next((r for r in cr_list.json() if r["id"] == test_report_id), None)
        assert rep_entry is not None
        assert rep_entry["location_id"] is None  # Unassigned by default!

        # Authority links citizen report to loc1
        link_res = await client.post(
            f"/api/sites/citizen-reports/{test_report_id}/link",
            headers=headers,
            json={
                "location_id": loc1_id,
                "linked_by": "Inspector Kabir",
                "notes": "Photo clearly shows Apex Footwear Building A east roof drain.",
            },
        )
        assert link_res.status_code == 200

        # Verify linked status
        cr_list_after = await client.get(f"/api/sites/citizen-reports?ward_id=DHK-001", headers=headers)
        linked_entry = next((r for r in cr_list_after.json() if r["id"] == test_report_id), None)
        assert linked_entry["location_id"] == loc1_id
        assert linked_entry["location_code"] == "APEX-ROOF-DRAIN-01"

        # -------------------------------------------------------------
        # 12. Correct/Re-link and Unlink citizen report (Feature E)
        # -------------------------------------------------------------
        # Correct link to loc2
        relink_res = await client.post(
            f"/api/sites/citizen-reports/{test_report_id}/link",
            headers=headers,
            json={
                "location_id": loc2_id,
                "linked_by": "Inspector Kabir",
                "notes": "Corrected location after further photo review.",
            },
        )
        assert relink_res.status_code == 200

        cr_check2 = await client.get(f"/api/sites/citizen-reports?ward_id=DHK-001", headers=headers)
        corrected_entry = next((r for r in cr_check2.json() if r["id"] == test_report_id), None)
        assert corrected_entry["location_id"] == loc2_id

        # Unlink/revoke
        unlink_res = await client.post(
            f"/api/sites/citizen-reports/{test_report_id}/unlink?reason=Photo+unclear",
            headers=headers,
        )
        assert unlink_res.status_code == 200

        cr_check3 = await client.get(f"/api/sites/citizen-reports?ward_id=DHK-001", headers=headers)
        unlinked_entry = next((r for r in cr_check3.json() if r["id"] == test_report_id), None)
        assert unlinked_entry["location_id"] is None

        # -------------------------------------------------------------
        # 13. Verify original routes still work without regressions (Step 6)
        # -------------------------------------------------------------
        h_res = await client.get("/api/health")
        assert h_res.status_code == 200
        assert h_res.json()["status"] == "ok"

        status_res = await client.get("/api/demo/status")
        assert status_res.status_code == 200

        lb_res = await client.get("/api/citizen/leaderboard")
        assert lb_res.status_code == 200


@pytest.mark.asyncio
async def test_edge_cases_and_validations():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login
        login_res = await client.post(
            "/api/authority/login",
            json={"username": "authority", "password": "dengue2026"},
        )
        token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Non-existent property returns 404
        non_prop = await client.get("/api/sites/properties/PROP-DOES-NOT-EXIST", headers=headers)
        assert non_prop.status_code == 404

        # 2. Non-existent location returns 404
        non_loc = await client.get("/api/sites/locations/LOC-DOES-NOT-EXIST", headers=headers)
        assert non_loc.status_code == 404

        # 3. Create property with missing fields returns 422
        bad_prop = await client.post("/api/sites/properties", headers=headers, json={"name": "A"})
        assert bad_prop.status_code == 422

        # 4. Property archiving and unarchiving
        props = (await client.get("/api/sites/properties", headers=headers)).json()
        target_prop = props[0]
        arch_res = await client.patch(
            f"/api/sites/properties/{target_prop['id']}/archive?archive=true",
            headers=headers,
        )
        assert arch_res.status_code == 200
        assert arch_res.json()["status"] == "archived"

        unarch_res = await client.patch(
            f"/api/sites/properties/{target_prop['id']}/archive?archive=false",
            headers=headers,
        )
        assert unarch_res.status_code == 200
        assert unarch_res.json()["status"] == "active"

        # 5. Invalid recurrence confirmation attempt: previous issue doesn't exist
        locs = (await client.get("/api/sites/locations", headers=headers)).json()
        target_loc = locs[0]
        new_iss_res = await client.post(
            f"/api/sites/locations/{target_loc['id']}/issues",
            headers=headers,
            json={"issue_type": "debris_accumulation", "description": "Leaf debris accumulating in outlet box."},
        )
        new_iss_id = new_iss_res.json()["id"]

        fake_rec = await client.post(
            f"/api/sites/issues/{new_iss_id}/confirm-recurrence",
            headers=headers,
            json={"previous_issue_id": "ISSUE-FAKE", "confirmed_by": "Inspector"},
        )
        assert fake_rec.status_code == 400


@pytest.mark.asyncio
async def test_idempotent_seeding():
    """Verify repeated seeding doesn't create duplicate properties or crash."""
    await init_db()
    await seed_wards()
    await seed_sites()
    await seed_sites()  # Second call must be a no-op

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"X-Authority-Key": "dengue-authority-dev-2026"}
        props = (await client.get("/api/sites/properties", headers=headers)).json()
        assert len(props) >= 4

