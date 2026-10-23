"""
Integration tests for Improvement 02 — Smart Reinspection Scheduling.
Verifies policy management, rainfall observations, explainable recommendations,
manager decision workflows, calendar views, and operational metrics.
"""

from datetime import date, timedelta
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from main import app
from db.database import init_db, seed_wards, seed_sites, seed_scheduling
from utils.auth import create_session, AuthorityUser


DEV_AUTH_KEY = "dengue-authority-dev-2026"


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_database():
    await init_db()
    await seed_wards()
    await seed_sites()
    await seed_scheduling()
    yield


@pytest.fixture
def auth_headers():
    return {"X-Authority-Key": DEV_AUTH_KEY}



@pytest.mark.asyncio
class TestSmartReinspectionScheduling:
    async def test_01_policies_and_rainfall(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Fetch default seeded policies
            p_res = await ac.get("/api/scheduling/policies", headers=auth_headers)
            assert p_res.status_code == 200
            policies = p_res.json()
            assert len(policies) >= 3
            global_pol = next((p for p in policies if p["scope_type"] == "global" and p["location_category"] == "all"), None)
            assert global_pol is not None
            assert global_pol["normal_interval_days"] == 14

            # 2. Fetch seeded rainfall observations
            r_res = await ac.get("/api/scheduling/rainfall", headers=auth_headers)
            assert r_res.status_code == 200
            rainfalls = r_res.json()
            assert len(rainfalls) >= 2
            bmd_rain = next((r for r in rainfalls if "BMD" in r["data_source"]), None)
            assert bmd_rain is not None
            assert bmd_rain["rainfall_mm"] > 25.0

    async def test_02_trigger_evaluation_and_recommendation_structure(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Trigger evaluation for all locations
            eval_res = await ac.post("/api/scheduling/evaluate", json={"force_reevaluate": False}, headers=auth_headers)
            assert eval_res.status_code == 200
            eval_data = eval_res.json()
            assert eval_data["evaluated_locations_count"] >= 1

            # Fetch recommendations
            rec_res = await ac.get("/api/scheduling/recommendations", headers=auth_headers)
            assert rec_res.status_code == 200
            recs = rec_res.json()
            assert len(recs) >= 1

            # Check that recommendations explain why they were made
            sample_rec = recs[0]
            assert "explanation" in sample_rec
            assert len(sample_rec["explanation"]) > 15
            assert "rule_code" in sample_rec
            assert "recommended_date" in sample_rec
            assert "supporting_records" in sample_rec
            assert sample_rec["evidence_level"] in ("sufficient_history", "limited_history")

    async def test_03_manager_decision_workflow_and_calendar(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Get proposed recommendations
            rec_res = await ac.get("/api/scheduling/recommendations?status_filter=proposed", headers=auth_headers)
            assert rec_res.status_code == 200
            proposed = rec_res.json()
            if not proposed:
                # Force evaluate to produce a recommendation
                await ac.post("/api/scheduling/evaluate", json={"force_reevaluate": True}, headers=auth_headers)
                rec_res = await ac.get("/api/scheduling/recommendations?status_filter=proposed", headers=auth_headers)
                proposed = rec_res.json()

            assert len(proposed) >= 1
            target_rec = proposed[0]
            rec_id = target_rec["id"]

            # 2. Manager approves the recommendation
            appr_res = await ac.post(
                f"/api/scheduling/recommendations/{rec_id}/decide",
                json={
                    "decision": "approved",
                    "approved_date": target_rec["recommended_date"],
                    "decision_notes": "Manager confirmed follow-up visit based on rainfall and recurring pattern."
                },
                headers=auth_headers
            )
            assert appr_res.status_code == 200
            appr_data = appr_res.json()
            assert appr_data["status"] == "approved"
            assert appr_data["decided_by"] is not None

            # 3. Verify scheduled inspection visit was automatically created
            sched_res = await ac.get(f"/api/scheduling/scheduled?location_id={target_rec['location_id']}", headers=auth_headers)
            assert sched_res.status_code == 200
            scheds = sched_res.json()
            assert any(s["recommendation_id"] == rec_id for s in scheds)

            # 4. Check unified calendar
            cal_res = await ac.get("/api/scheduling/calendar", headers=auth_headers)
            assert cal_res.status_code == 200
            calendar_items = cal_res.json()
            assert len(calendar_items) >= 1
            approved_cal = next((c for c in calendar_items if c["item_type"] == "approved_visit"), None)
            assert approved_cal is not None

            # 5. Check operational statistics
            stats_res = await ac.get("/api/scheduling/stats", headers=auth_headers)
            assert stats_res.status_code == 200
            stats = stats_res.json()
            assert stats["total_recommendations"] >= 1
            assert stats["approved_recommendations"] >= 1
            assert stats["acceptance_rate_pct"] > 0.0

            # 6. Check single location status endpoint
            loc_status_res = await ac.get(f"/api/scheduling/location/{target_rec['location_id']}/status", headers=auth_headers)
            assert loc_status_res.status_code == 200
            loc_status = loc_status_res.json()
            assert loc_status["effective_policy_name"] is not None
            assert loc_status["next_approved_visit"] is not None
