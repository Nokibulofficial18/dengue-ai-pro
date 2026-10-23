"""
Integration tests for Improvement 04 — Permanent Repair and Cost-Savings Recommendations.
Verifies:
- Identification of recurring-cost opportunities and portfolio economics
- Decimal-safe historical maintenance cost logging by service visit
- Qualified engineering technical root-cause assessments
- Proposed repair alternatives and multi-quote contractor comparisons
- On-the-fly 3-scenario financial modeling (Optimistic, Expected, Cautious)
- Auditable financial scenario snapshot persistence
- Managerial approval workflows with strict role-based authorization guards
- Integration with Improvement 03 service work order dispatch
- Post-repair outcome evaluations (monitoring follow-up inspections, recurrences, and spending)
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from main import app
from db.database import init_db, seed_wards, seed_sites, seed_scheduling, seed_services, seed_repairs


DEV_AUTH_KEY = "dengue-authority-dev-2026"


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_database():
    await init_db()
    await seed_wards()
    await seed_sites()
    await seed_scheduling()
    await seed_services()
    await seed_repairs()
    # Ensure test entries are cleared before and after
    from db.database import AsyncSessionLocal
    from sqlalchemy import text
    async with AsyncSessionLocal() as session:
        await session.execute(text("DELETE FROM maintenance_cost_entries WHERE invoice_ref LIKE 'INV-2026-TEST%'"))
        await session.commit()
    yield
    async with AsyncSessionLocal() as session:
        await session.execute(text("DELETE FROM maintenance_cost_entries WHERE invoice_ref LIKE 'INV-2026-TEST%'"))
        await session.commit()


@pytest.fixture
def auth_headers():
    return {"X-Authority-Key": DEV_AUTH_KEY}


@pytest.mark.asyncio
class TestPermanentRepairAndCostSavings:
    async def test_01_portfolio_repair_economics(self, auth_headers):
        """Verify portfolio capital planning and maintenance economics aggregation."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/repair-planning/portfolio", headers=auth_headers)
            assert res.status_code == 200
            data = res.json()
            assert data["currency"] == "BDT"
            assert data["total_locations_tracked"] >= 10
            assert data["locations_with_recurring_costs"] >= 1
            assert data["total_historical_maintenance_spend"] > 0
            assert data["total_repair_proposals"] >= 1
            assert "property_breakdown" in data

    async def test_02_identify_repair_opportunities(self, auth_headers):
        """Verify locations with repeated problems and documented costs are identified."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/repair-planning/opportunities?min_recurrences=1", headers=auth_headers)
            assert res.status_code == 200
            opps = res.json()
            assert len(opps) > 0

            # Find the seeded Mirpur drain opportunity
            mirpur_opp = next((o for o in opps if o["location_id"] == "LOC-MIR-01"), None)
            assert mirpur_opp is not None
            assert mirpur_opp["confirmed_recurrence_count"] >= 1
            assert mirpur_opp["total_maintenance_spend"] >= 8000.0
            assert mirpur_opp["has_technical_assessment"] is True
            assert mirpur_opp["has_repair_proposal"] is True
            assert mirpur_opp["decision_support_category"] in ("financially_promising", "ready_for_financial_review")

    async def test_03_historical_cost_tracking(self, auth_headers):
        """Test logging a new maintenance expense line item and retrieving cost breakdown."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Log a new expense
            cost_payload = {
                "property_id": "PROP-MIR-01",
                "location_id": "LOC-MIR-01",
                "cost_category": "materials",
                "amount": 1500.0,
                "currency": "BDT",
                "expense_date": "2026-10-20",
                "description": "Emergency PVC drain cap and sealant",
                "invoice_ref": "INV-2026-TEST-99",
                "status": "verified",
            }
            res = await ac.post("/api/repair-planning/costs", json=cost_payload, headers=auth_headers)
            assert res.status_code == 201
            entry = res.json()
            assert entry["amount"] == 1500.0
            assert entry["currency"] == "BDT"
            assert entry["status"] == "verified"

            # 2. Retrieve location cost summary
            sum_res = await ac.get("/api/repair-planning/locations/LOC-MIR-01/costs", headers=auth_headers)
            assert sum_res.status_code == 200
            summary = sum_res.json()
            assert summary["total_recorded_cost"] >= 10000.0
            assert "materials" in summary["cost_by_category"]
            assert summary["cost_by_category"]["materials"] >= 1500.0

    async def test_04_qualified_technical_assessment(self, auth_headers):
        """Verify recording in-person technical engineering assessments."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            payload = {
                "property_id": "PROP-MIR-01",
                "location_id": "LOC-MIR-01",
                "assessor_name": "Engr. Monirul Haque, P.Eng.",
                "assessor_role": "Senior Hydraulic & Structural Engineer",
                "assessment_date": "2026-10-21",
                "problem_description": "Structural sag in middle channel causing 40mm standing water pool.",
                "suspected_root_cause": "Corrosion of secondary support bracket and insufficient slope.",
                "observations": "Water retains 96 hours post-monsoon rain. Aedes larvae observed in samples.",
                "recommended_action": "Replace bracket with galvanized steel and re-align slope to 1:50 gradient.",
                "feasibility": "repair_feasible",
                "safety_considerations": "Work at 8m elevation requires full harness and tie-off line.",
            }
            res = await ac.post("/api/repair-planning/assessments", json=payload, headers=auth_headers)
            assert res.status_code == 201
            data = res.json()
            assert data["assessor_name"] == "Engr. Monirul Haque, P.Eng."
            assert data["feasibility"] == "repair_feasible"
            assessment_id = data["id"]

            # Query assessments list
            list_res = await ac.get(f"/api/repair-planning/assessments?location_id=LOC-MIR-01", headers=auth_headers)
            assert list_res.status_code == 200
            assert any(a["id"] == assessment_id for a in list_res.json())

    async def test_05_repair_proposal_and_supplier_quotations(self, auth_headers):
        """Verify proposal registration and attaching multi-supplier quotations."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Create a proposal
            prop_payload = {
                "property_id": "PROP-MIR-01",
                "location_id": "LOC-MIR-01",
                "title": "Comprehensive Gutter Alignment and Bracket Replacement",
                "description": "Replace rusted brackets, install galvanized supports, and realign slope.",
                "responsible_assessor": "Engr. Monirul Haque, P.Eng.",
                "proposed_method": "Hot-dip galvanized steel brackets with self-cleaning downspout siphon.",
                "expected_service_life_years": 8.0,
                "expected_maintenance_after_per_month": 200.0,
                "safety_considerations": "Certified fall protection required.",
                "operational_interruption_hours": 4.0,
            }
            p_res = await ac.post("/api/repair-planning/proposals", json=prop_payload, headers=auth_headers)
            assert p_res.status_code == 201
            proposal = p_res.json()
            proposal_id = proposal["id"]
            assert proposal["status"] in ("draft", "ready_for_financial_review")

            # 2. Add Supplier Quotation 1
            q1_payload = {
                "supplier_name": "Apex Engineering & Drainage Ltd.",
                "quoted_amount": 14000.0,
                "currency": "BDT",
                "scope_of_work": "Supply & installation of 6 heavy duty brackets, gutter realignment, and 12-month warranty.",
                "included_materials": "Galvanized brackets, stainless steel bolts, industrial silicone sealant",
                "excluded_costs": "Scaffolding permit fees if required by municipality",
                "lead_time_days": 5,
                "valid_until": "2026-12-31",
                "warranty_months": 24,
            }
            q1_res = await ac.post(f"/api/repair-planning/proposals/{proposal_id}/quotations", json=q1_payload, headers=auth_headers)
            assert q1_res.status_code == 201
            q1 = q1_res.json()
            assert q1["quoted_amount"] == 14000.0

            # 3. Add Supplier Quotation 2 (competing)
            q2_payload = {
                "supplier_name": "Bengal Vector Defense Construction",
                "quoted_amount": 11500.0,
                "currency": "BDT",
                "scope_of_work": "Standard bracket reinforcement and slope leveling with standard silicone.",
                "included_materials": "Mild steel brackets with anti-rust paint, anchor bolts",
                "excluded_costs": "Disposal of corroded metal debris",
                "lead_time_days": 3,
                "valid_until": "2026-11-30",
                "warranty_months": 12,
            }
            q2_res = await ac.post(f"/api/repair-planning/proposals/{proposal_id}/quotations", json=q2_payload, headers=auth_headers)
            assert q2_res.status_code == 201
            q2 = q2_res.json()
            assert q2["quoted_amount"] == 11500.0

            # 4. List quotations for proposal
            quotes_res = await ac.get(f"/api/repair-planning/proposals/{proposal_id}/quotations", headers=auth_headers)
            assert quotes_res.status_code == 200
            assert len(quotes_res.json()) >= 2

    async def test_06_three_scenario_financial_engine(self, auth_headers):
        """Test on-the-fly 3-scenario financial comparison (Optimistic, Expected, Cautious)."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.post(
                "/api/repair-planning/proposals/PROP-REP-MIR-01/calculate?quotation_id=QUOTE-MIR-001&evaluation_period_months=12",
                headers=auth_headers,
            )
            assert res.status_code == 200
            calc = res.json()
            assert calc["supplier_name"] == "Rapid Drainage & Vector Solutions Ltd."
            assert calc["quoted_amount"] == 10000.0

            # Check 3 explicit scenarios
            opt = calc["optimistic_scenario"]
            exp = calc["expected_scenario"]
            caut = calc["cautious_scenario"]

            assert opt["scenario_name"] == "Optimistic"
            assert opt["simple_payback_months"] is not None
            assert opt["simple_payback_months"] < exp["simple_payback_months"]

            assert exp["scenario_name"] == "Expected"
            assert exp["is_financially_viable"] is True
            assert exp["simple_payback_months"] is not None
            assert 3.0 <= exp["simple_payback_months"] <= 6.0

            assert caut["scenario_name"] == "Cautious"
            assert caut["simple_payback_months"] is not None
            assert caut["simple_payback_months"] > exp["simple_payback_months"]

            # Verify uncertainty disclaimer is present
            assert "Estimated outcome — not guaranteed" in calc["caveat_statement"]

    async def test_07_save_scenario_snapshot(self, auth_headers):
        """Verify persisting an auditable snapshot of the financial comparison."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            payload = {
                "quotation_id": "QUOTE-MIR-001",
                "evaluation_period_months": 24,
                "assumptions_notes": "Reviewed with facility engineer; seasonal monsoon recurrence assumed 3 times/year.",
                "is_approved_baseline": True,
            }
            res = await ac.post("/api/repair-planning/proposals/PROP-REP-MIR-01/save-scenario", json=payload, headers=auth_headers)
            assert res.status_code == 201
            scenario = res.json()
            assert scenario["evaluation_period_months"] == 24
            assert scenario["is_approved_baseline"] is True

    async def test_08_approval_governance_and_role_guards(self):
        """
        Test managerial approval workflow:
        Workers and technical assessors MUST NOT be allowed to approve budgets (HTTP 403).
        Property Managers and Finance Approvers CAN approve (HTTP 201).
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Login as a worker
            w_login = await ac.post("/api/authority/login", json={"username": "authority", "password": "dengue2026", "role": "worker"})
            worker_token = w_login.json()["token"]
            worker_headers = {"Authorization": f"Bearer {worker_token}"}

            approval_payload = {
                "quotation_id": "QUOTE-MIR-001",
                "decision": "approved",
                "decision_notes": "Self-approval attempt by contractor worker.",
                "approved_budget": 10000.0,
            }

            # Worker attempt to approve must fail with 403 Forbidden
            fail_res = await ac.post("/api/repair-planning/proposals/PROP-REP-MIR-01/approve", json=approval_payload, headers=worker_headers)
            assert fail_res.status_code == 403
            assert "not authorized" in fail_res.json()["detail"].lower()

            # 2. Login as property manager
            pm_login = await ac.post("/api/authority/login", json={"username": "authority", "password": "dengue2026", "role": "property_manager"})
            pm_token = pm_login.json()["token"]
            pm_headers = {"Authorization": f"Bearer {pm_token}"}

            # Property Manager approval succeeds
            ok_res = await ac.post("/api/repair-planning/proposals/PROP-REP-MIR-01/approve", json=approval_payload, headers=pm_headers)
            assert ok_res.status_code == 201
            decision = ok_res.json()
            assert decision["decision"] == "approved"
            assert decision["approved_budget"] == 10000.0

            # Verify proposal status changed to 'approved'
            prop_res = await ac.get("/api/repair-planning/proposals/PROP-REP-MIR-01", headers=pm_headers)
            assert prop_res.json()["status"] == "approved"

    async def test_09_convert_approved_repair_to_service_work_order(self, auth_headers):
        """
        Verify approved proposal can launch an executable work order
        in Improvement 03 infrastructure without duplicate systems.
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            wo_payload = {
                "assigned_worker_name": "Rafiqul Islam (Lead Welder)",
                "due_date": "2026-11-05",
                "responsible_supervisor": "Engr. Monirul Haque",
            }
            res = await ac.post(
                "/api/repair-planning/proposals/PROP-REP-MIR-01/create-work-order",
                json=wo_payload,
                headers=auth_headers,
            )
            assert res.status_code == 200
            wo = res.json()
            assert wo["repair_classification"] == "permanent_repair"
            assert wo["property_id"] == "PROP-MIR-01"
            assert wo["location_id"] == "LOC-MIR-01"
            assert wo["assigned_worker_name"] == "Rafiqul Islam (Lead Welder)"

    async def test_10_post_repair_outcome_tracking(self, auth_headers):
        """
        Verify tracking actual results after repair completion:
        Follow-up inspections, new recurrences, cost variance, and realized savings.
        """
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/api/repair-planning/proposals/PROP-REP-TEJ-01/outcomes", headers=auth_headers)
            assert res.status_code == 200
            outcome = res.json()
            assert outcome["proposal_id"] == "PROP-REP-TEJ-01"
            assert outcome["approved_quote_amount"] == 8000.0
            assert outcome["actual_repair_cost"] == 2200.0
            assert outcome["days_since_completion"] >= 0
            assert "Monitoring active" in outcome["status_summary"]
