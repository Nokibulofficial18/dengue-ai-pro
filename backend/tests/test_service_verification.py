"""
Integration tests for Improvement 03 — Service and Resolution Verification.
Verifies work order lifecycle, worker evidence submission, duplicate file detection,
supervisor review decisions, independent follow-up resolution confirmation,
location timeline events, and role-based permissions.
"""

import io
from datetime import date, timedelta
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from main import app
from db.database import init_db, seed_wards, seed_sites, seed_scheduling, seed_services


DEV_AUTH_KEY = "dengue-authority-dev-2026"


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_database():
    await init_db()
    await seed_wards()
    await seed_sites()
    await seed_scheduling()
    await seed_services()
    yield


@pytest.fixture
def auth_headers():
    return {"X-Authority-Key": DEV_AUTH_KEY}


@pytest.mark.asyncio
class TestServiceAndResolutionVerification:
    async def test_01_seeded_work_orders_and_stats(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Fetch work orders
            wo_res = await ac.get("/api/services/work-orders", headers=auth_headers)
            assert wo_res.status_code == 200
            wos = wo_res.json()
            assert len(wos) >= 3

            # Check that seeded work orders have the expected statuses
            wo1 = next((w for w in wos if w["id"] == "WO-MIR-2026-001"), None)
            assert wo1 is not None

            wo2 = next((w for w in wos if w["id"] == "WO-TEJ-2026-002"), None)
            assert wo2 is not None
            assert wo2["status"] == "work_verified"
            assert wo2["resolution_verification_status"] == "resolution_confirmed"

            # 2. Operational Stats
            stats_res = await ac.get("/api/services/stats", headers=auth_headers)
            assert stats_res.status_code == 200
            stats = stats_res.json()
            assert stats["total_work_orders"] >= 3
            assert stats["work_verified_count"] >= 1
            assert stats["resolution_confirmed_count"] >= 1
            assert "contractor_performance" in stats
            assert len(stats["contractor_performance"]) >= 1

    async def test_02_create_work_order_and_worker_start(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Create a new work order for Mirpur basement sump (valid location LOC-MIR-02)
            new_wo_payload = {
                "property_id": "PROP-MIR-01",
                "location_id": "LOC-MIR-02",
                "issue_id": None,
                "title": "Clear stagnant runoff from underground sump",
                "description": "Drain accumulated monsoon water and apply granular larvicide",
                "required_action": "Drain water & larvicide treatment",
                "priority": "high",
                "assigned_worker_id": "WRK-001",
                "assigned_worker_name": "Rafiqul Islam",
                "assigned_contractor": "CleanCity Vector Services",
                "responsible_supervisor": "Dr. Shamsul Alam",
                "due_date": (date.today() + timedelta(days=2)).isoformat(),
                "labor_hours": 2.5,
                "actual_cost": 3200.0,
                "currency": "BDT",
                "repair_classification": "temporary_mitigation"
            }
            create_res = await ac.post("/api/services/work-orders", json=new_wo_payload, headers=auth_headers)
            assert create_res.status_code == 201
            created_wo = create_res.json()
            wo_id = created_wo["id"]
            assert created_wo["status"] == "assigned"
            assert created_wo["resolution_verification_status"] == "awaiting_followup"
            assert created_wo["actual_cost"] == 3200.0

            # Worker marks task as started
            start_res = await ac.post(f"/api/services/work-orders/{wo_id}/start", headers=auth_headers)
            assert start_res.status_code == 200
            started_wo = start_res.json()
            assert started_wo["status"] == "in_progress"
            assert started_wo["started_at"] is not None

    async def test_03_submit_evidence_with_duplicate_detection(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Create a dedicated fresh work order to test evidence submission
            wo_res = await ac.post("/api/services/work-orders", json={
                "property_id": "PROP-MIR-01",
                "location_id": "LOC-MIR-02",
                "title": "Clean and drain basement sump unit A",
                "required_action": "Drain standing water",
                "priority": "medium",
                "assigned_worker_name": "Kader Ali",
                "responsible_supervisor": "Dr. Shamsul Alam",
                "due_date": (date.today() + timedelta(days=2)).isoformat()
            }, headers=auth_headers)
            assert wo_res.status_code == 201
            wo_id = wo_res.json()["id"]

            # Start the work order
            await ac.post(f"/api/services/work-orders/{wo_id}/start", headers=auth_headers)

            import uuid
            img_bytes = f"UNIQUE_IMAGE_SAMPLE_{uuid.uuid4().hex}".encode("utf-8")
            files = [
                ("files", ("sump_cleared.jpg", io.BytesIO(img_bytes), "image/jpeg")),
            ]
            form_data = {
                "action_type": "Drained",
                "work_description": "Extracted 200L standing water, scrubbed perimeter, spread Bacillus thuringiensis",
                "materials_used": "Submersible pump, 500g Bti larvicide",
                "unresolved_notes": "",
                "access_restricted": "false",
                "evidence_category": "after_photo",
                "labor_hours": "3.0",
                "actual_cost": "4500.0"
            }

            sub_res = await ac.post(f"/api/services/work-orders/{wo_id}/submit-evidence", data=form_data, files=files, headers=auth_headers)
            assert sub_res.status_code == 200, f"Failed: {sub_res.text}"
            res_wo = sub_res.json()
            assert res_wo["status"] == "evidence_submitted"
            assert len(res_wo["submissions"]) >= 1
            latest_sub = res_wo["submissions"][0]
            assert len(latest_sub["files"]) >= 1
            first_file = latest_sub["files"][0]
            assert first_file["is_duplicate_flag"] is False

            # Now submit the SAME file bytes to another work order to verify duplicate detection flag
            dup_wo_res = await ac.post("/api/services/work-orders", json={
                "property_id": "PROP-MIR-01",
                "location_id": "LOC-MIR-01",
                "title": "Duplicate evidence test work order",
                "required_action": "Check drainage",
                "priority": "low",
                "assigned_worker_name": "Worker 2",
                "responsible_supervisor": "Supervisor 1",
                "due_date": (date.today() + timedelta(days=1)).isoformat()
            }, headers=auth_headers)
            assert dup_wo_res.status_code == 201
            dup_wo_id = dup_wo_res.json()["id"]

            files_dup = [
                ("files", ("identical_photo.jpg", io.BytesIO(img_bytes), "image/jpeg")),
            ]
            form_data_dup = {
                "action_type": "Cleaned",
                "work_description": "Cleaned area",
                "evidence_category": "after_photo"
            }
            dup_sub_res = await ac.post(f"/api/services/work-orders/{dup_wo_id}/submit-evidence", data=form_data_dup, files=files_dup, headers=auth_headers)
            assert dup_sub_res.status_code == 200
            dup_wo = dup_sub_res.json()
            dup_file = dup_wo["submissions"][0]["files"][0]
            assert dup_file["is_duplicate_flag"] is True, "Exact duplicate hash must be flagged as duplicate"

    async def test_04_supervisor_review_queue_and_decision(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Create a dedicated work order in evidence_submitted for review testing
            wo_res = await ac.post("/api/services/work-orders", json={
                "property_id": "PROP-MIR-01",
                "location_id": "LOC-MIR-01",
                "title": "North roof downspout debris clearance",
                "required_action": "Clean debris",
                "priority": "high",
                "assigned_worker_name": "Tariqul Alam",
                "responsible_supervisor": "Engr. Farhana Ahmed",
                "due_date": (date.today() + timedelta(days=1)).isoformat()
            }, headers=auth_headers)
            assert wo_res.status_code == 201
            wo_id = wo_res.json()["id"]

            await ac.post(f"/api/services/work-orders/{wo_id}/submit-evidence", data={
                "action_type": "Cleaned",
                "work_description": "Cleared heavy debris from roof gutter.",
                "evidence_category": "after_photo"
            }, files=[("files", ("drain.jpg", io.BytesIO(b"INITIAL_PHOTO_DATA_ROOF_DRAIN"), "image/jpeg"))], headers=auth_headers)

            # 1. Check supervisor review queue
            queue_res = await ac.get("/api/services/reviews/queue", headers=auth_headers)
            assert queue_res.status_code == 200
            queue = queue_res.json()
            assert any(q["id"] == wo_id for q in queue)

            # 2. Supervisor requests clarification
            clarify_payload = {
                "decision": "clarification_required",
                "decision_notes": "Please provide an overhead shot showing that the downspout strainer was also cleared of leaves."
            }
            clarify_res = await ac.post(f"/api/services/work-orders/{wo_id}/review", json=clarify_payload, headers=auth_headers)
            assert clarify_res.status_code == 200
            clarified_wo = clarify_res.json()
            assert clarified_wo["status"] == "clarification_required"

            # 3. Worker resubmits evidence with additional photo
            files_resub = [
                ("files", ("downspout_strainer.jpg", io.BytesIO(b"DOWNSPOUT_STRAINER_CLEANED_PHOTO_DATA"), "image/jpeg"))
            ]
            resub_form = {
                "action_type": "Cleaned",
                "work_description": "Added overhead view confirming downspout strainer is completely clear",
                "evidence_category": "after_photo"
            }
            resub_res = await ac.post(f"/api/services/work-orders/{wo_id}/submit-evidence", data=resub_form, files=files_resub, headers=auth_headers)
            assert resub_res.status_code == 200
            assert resub_res.json()["status"] == "evidence_submitted"

            # 4. Supervisor accepts work -> Work Verified (NOT automatically issue resolved!)
            accept_payload = {
                "decision": "accepted",
                "decision_notes": "Overhead photo verifies complete debris removal and drain flow. Work verified.",
            }
            accept_res = await ac.post(f"/api/services/work-orders/{wo_id}/review", json=accept_payload, headers=auth_headers)
            assert accept_res.status_code == 200
            verified_wo = accept_res.json()
            assert verified_wo["status"] == "work_verified"
            # Note: Resolution verification status MUST STILL be awaiting follow-up!
            assert verified_wo["resolution_verification_status"] == "awaiting_followup"

    async def test_05_independent_followup_resolution_confirmation(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Create a work order, submit evidence, and verify work
            wo_res = await ac.post("/api/services/work-orders", json={
                "property_id": "PROP-MIR-01",
                "location_id": "LOC-MIR-01",
                "title": "Downspout gutter clearance for follow-up testing",
                "required_action": "Clean gutter",
                "priority": "high",
                "assigned_worker_name": "Tariqul Alam",
                "responsible_supervisor": "Engr. Farhana Ahmed",
                "due_date": (date.today() + timedelta(days=1)).isoformat()
            }, headers=auth_headers)
            wo_id = wo_res.json()["id"]

            await ac.post(f"/api/services/work-orders/{wo_id}/submit-evidence", data={
                "action_type": "Cleaned",
                "work_description": "Removed gutter sediment",
                "evidence_category": "after_photo"
            }, files=[("files", ("gutter.jpg", io.BytesIO(b"GUTTER_PHOTO_CLEAN"), "image/jpeg"))], headers=auth_headers)

            await ac.post(f"/api/services/work-orders/{wo_id}/review", json={
                "decision": "accepted",
                "decision_notes": "Work accepted by supervisor"
            }, headers=auth_headers)

            # Check that resolution follow-up queue contains this work order
            f_queue_res = await ac.get("/api/services/follow-up/queue", headers=auth_headers)
            assert f_queue_res.status_code == 200
            f_queue = f_queue_res.json()
            assert any(item["id"] == wo_id for item in f_queue)

            # Inspector visits site after rain and confirms: Clear (No stagnant water found)
            followup_payload = {
                "verified_outcome": "clear",
                "verification_notes": "Post-rain inspection confirms drainage channel is free-flowing and no ponding occurred.",
                "inspector_name": "Senior Inspector Zahid"
            }
            fu_res = await ac.post(f"/api/services/work-orders/{wo_id}/record-followup", json=followup_payload, headers=auth_headers)
            assert fu_res.status_code == 200
            fu_wo = fu_res.json()

            assert fu_wo["resolution_verification_status"] == "resolution_confirmed"

            # Verify that location timeline now has activity events
            loc_id = fu_wo["location_id"]
            timeline_res = await ac.get(f"/api/sites/locations/{loc_id}/timeline", headers=auth_headers)
            assert timeline_res.status_code == 200
            timeline = timeline_res.json()
            titles = [ev["title"].lower() for ev in timeline["events"]]
            assert any("work verified" in t for t in titles)
            assert any("resolution confirmed" in t for t in titles)

    async def test_06_role_permission_enforcement(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Login as a field worker
            login_res = await ac.post("/api/authority/login", json={
                "username": "authority",
                "password": "dengue2026",
                "role": "worker"
            })
            assert login_res.status_code == 200
            worker_token = login_res.json()["token"]
            worker_headers = {"Authorization": f"Bearer {worker_token}"}

            # Worker attempts to verify a work order -> must return 403 Forbidden
            forbidden_res = await ac.post("/api/services/work-orders/WO-TEJ-2026-002/review", json={
                "decision": "accepted",
                "decision_notes": "Attempting worker self-verification"
            }, headers=worker_headers)
            assert forbidden_res.status_code == 403
            assert "Forbidden" in forbidden_res.json()["detail"]
