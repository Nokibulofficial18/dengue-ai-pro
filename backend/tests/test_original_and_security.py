"""
Tests for Original Functionality, Dispatch Idempotency, Citizen Reporting Security,
SWAPI Calculation Accuracy, RAG Fallback, and Multi-Tenant Security Isolation.
"""
import io
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from main import app
from db.database import init_db, seed_wards, seed_sites, seed_scheduling, seed_services, seed_repairs, seed_coordination, AsyncSessionLocal
from models.swapi_model import WeatherData, compute_swapi, get_risk_level, get_risk_color
from rag.retriever import retrieve_context


DEV_AUTH_KEY = "dengue-authority-dev-2026"


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_database():
    await init_db()
    await seed_wards()
    await seed_sites()
    await seed_scheduling()
    await seed_services()
    await seed_repairs()
    await seed_coordination()
    yield


@pytest.fixture
def auth_headers():
    return {"X-Authority-Key": DEV_AUTH_KEY}


@pytest.mark.asyncio
class TestOriginalAndSecurity:
    async def test_01_dispatch_queue_idempotency_no_duplicates_on_get(self, auth_headers):
        """Verify that GET /api/dispatch/queue is strictly read-safe and does not flood duplicate orders."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # First call to queue
            res1 = await ac.get("/api/dispatch/queue")
            assert res1.status_code == 200
            orders1 = res1.json()
            assert len(orders1) > 0

            # Count rows in dispatch_orders
            async with AsyncSessionLocal() as session:
                count_initial = (await session.execute(text("SELECT COUNT(*) FROM dispatch_orders"))).scalar_one()

            # Call GET /api/dispatch/queue 3 more times (simulating client polling)
            for _ in range(3):
                res = await ac.get("/api/dispatch/queue")
                assert res.status_code == 200

            # Count rows again; must NOT increase
            async with AsyncSessionLocal() as session:
                count_after = (await session.execute(text("SELECT COUNT(*) FROM dispatch_orders"))).scalar_one()

            assert count_after == count_initial, (
                f"GET /dispatch/queue mutated the database! Count before: {count_initial}, after: {count_after}"
            )

    async def test_02_citizen_reporting_security_and_file_validation(self, auth_headers):
        """Verify file extension restrictions and maximum size limits on citizen reports."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Reject invalid file format (.exe)
            malicious_file = ("malware.exe", io.BytesIO(b"MZ executable content"), "application/x-dosexec")
            res_bad_format = await ac.post(
                "/api/citizen/report",
                data={"ward_id": "DHK-001"},
                files={"photo": malicious_file},
            )
            assert res_bad_format.status_code == 400
            assert "Invalid photo format" in res_bad_format.json()["detail"]

            # 2. Reject file exceeding 10MB limit
            oversized_bytes = b"0" * (10 * 1024 * 1024 + 500)
            oversized_file = ("huge_photo.jpg", io.BytesIO(oversized_bytes), "image/jpeg")
            res_oversized = await ac.post(
                "/api/citizen/report",
                data={"ward_id": "DHK-001"},
                files={"photo": oversized_file},
            )
            assert res_oversized.status_code == 400
            assert "exceeds maximum allowed 10MB limit" in res_oversized.json()["detail"]

            # 3. Valid photo submission: awards participation points, records report, sets pending verification
            valid_file = ("larvae_puddle.jpg", io.BytesIO(b"\xFF\xD8\xFF\xE0 fake jpeg content"), "image/jpeg")
            res_valid = await ac.post(
                "/api/citizen/report",
                data={"ward_id": "DHK-001"},
                files={"photo": valid_file},
            )
            assert res_valid.status_code == 200
            data = res_valid.json()
            assert data["verified"] is False
            assert data["status"] == "pending_verification"
            assert data["points_awarded"] == 5
            assert "Pending field verification" in data["message_en"]

    async def test_03_swapi_mathematical_range_and_low_risk_classification(self):
        """Verify SWAPI score range [0, 1] and ensure 'low' risk level is reachable."""
        # 1. Dry, sunny, well-drained weather condition -> must be low risk (< 0.3)
        dry_weather = WeatherData(
            rainfall_3day_mm=0.0,
            humidity_percent=30.0,
            sunlight_hours=11.5,
            temp_max=36.0,
            temp_min=20.0,
        )
        res_low = compute_swapi("W-TEST-LOW", "Low Risk Ward", dry_weather, drainage_coefficient=0.95)
        assert 0.0 <= res_low.score < 0.3
        assert res_low.risk_level == "low"
        assert get_risk_level(res_low.score) == "low"
        assert get_risk_color(res_low.score) == "#1E6B2E"

        # 2. Severe monsoon condition -> must be critical (>= 0.7)
        monsoon_weather = WeatherData(
            rainfall_3day_mm=120.0,
            humidity_percent=95.0,
            sunlight_hours=1.0,
            temp_max=29.0,
            temp_min=27.5,
        )
        res_crit = compute_swapi("W-TEST-CRIT", "Critical Ward", monsoon_weather, drainage_coefficient=0.1)
        assert res_crit.score >= 0.7
        assert res_crit.risk_level == "critical"
        assert get_risk_color(res_crit.score) == "#C0392B"

    async def test_04_rag_retrieval_deterministic_lexical_fallback(self):
        """Verify RAG retrieval produces valid WHO guidance without random embeddings."""
        chunks = await retrieve_context("stagnant water larvicide aedes breeding", top_k=2)
        assert len(chunks) == 2
        for chunk in chunks:
            assert "content" in chunk
            assert "source" in chunk
            assert chunk["similarity"] >= 0.0
            assert chunk["retrieval_mode"] in ("lexical_overlap", "semantic")

    async def test_05_multi_tenant_isolation_organization_dashboards(self, auth_headers):
        """Verify that organization-specific dashboards strictly isolate tenant properties and work orders."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Fetch Bengal Apparel Dashboard
            res_bengal = await ac.get("/api/organizations/ORG-BENGAL-APP/dashboard", headers=auth_headers)
            assert res_bengal.status_code == 200
            bengal_data = res_bengal.json()
            assert bengal_data["organization"]["id"] == "ORG-BENGAL-APP"
            bengal_prop_ids = [p["id"] for p in bengal_data["properties"]]
            assert "PROP-MIR-01" in bengal_prop_ids
            assert "PROP-TEJ-01" not in bengal_prop_ids  # Must NOT contain Delta's property

            # 2. Fetch Delta Manufacturing Dashboard
            res_delta = await ac.get("/api/organizations/ORG-DELTA-MFG/dashboard", headers=auth_headers)
            assert res_delta.status_code == 200
            delta_data = res_delta.json()
            assert delta_data["organization"]["id"] == "ORG-DELTA-MFG"
            delta_prop_ids = [p["id"] for p in delta_data["properties"]]
            assert "PROP-TEJ-01" in delta_prop_ids
            assert "PROP-MIR-01" not in delta_prop_ids  # Must NOT contain Bengal's property

    async def test_06_financial_privacy_in_consortium_views(self, auth_headers):
        """Verify that shared repairs endpoint does not expose supplier quotations or confidential scenario margins."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            repairs_res = await ac.get(
                "/api/coordination/groups/GRP-TEJGAON-IND/repairs",
                headers=auth_headers,
                params={"requester_org_id": "ORG-DELTA-MFG"}
            )
            assert repairs_res.status_code == 200
            data = repairs_res.json()
            # Must NOT expose private supplier quotes or internal markups
            for proposal in data:
                assert "supplier_quotations" not in proposal
                assert "internal_margins" not in proposal
