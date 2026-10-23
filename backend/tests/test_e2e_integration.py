"""
TASK 06 — END-TO-END CROSS-FEATURE INTEGRATION TEST SUITE

Executes the complete 14-stage lifecycle across:
- Improvement 01: Permanent Hazard Location Records
- Improvement 02: Smart Reinspection Scheduling
- Improvement 03: Service and Resolution Verification
- Improvement 04: Permanent Repair and Cost Savings Recommendations
- Improvement 05: Coordinated Prevention Across Properties
- Database persistence and multi-tenant security verification
"""

import io
import uuid
from datetime import date, timedelta
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from main import app
from db.database import (
    init_db,
    seed_wards,
    seed_sites,
    seed_scheduling,
    seed_services,
    seed_repairs,
    seed_coordination,
    AsyncSessionLocal,
)


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
class TestCompleteCrossFeatureWorkflow:
    """Tests the full 14-stage cross-feature workflow as specified in Part 10."""

    async def test_complete_14_stage_lifecycle(self, auth_headers):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:

            # -----------------------------------------------------------------
            # STAGE 1 — Organization and Property Registration
            # -----------------------------------------------------------------
            org_a_payload = {
                "name": "Acme Pharmaceuticals Ltd",
                "org_type": "factory_company",
                "authorized_representative": "Dr. Tariq Anam",
                "representative_role": "Managing Director",
                "contact_person": "Dr. Tariq Anam",
                "contact_phone": "+880 1819-112233",
                "contact_email": "tariq@acmepharma.bd",
                "address": "Plot 12-14, Industrial Zone, Mirpur, Dhaka",
            }
            res_org_a = await client.post("/api/organizations", json=org_a_payload, headers=auth_headers)
            assert res_org_a.status_code == 201, res_org_a.text
            org_a = res_org_a.json()
            org_a_id = org_a["id"]

            prop_payload = {
                "name": "Acme Formulation Plant 1",
                "property_type": "industrial_facility",
                "ward_id": "DHK-001",
                "address": "Plot 12-14, Industrial Zone, Mirpur",
                "latitude": 23.8103,
                "longitude": 90.3687,
                "responsible_org": org_a["name"],
                "manager_name": "Dr. Tariq Anam",
                "manager_contact": "+880 1819-112233",
            }
            res_prop = await client.post("/api/sites/properties", json=prop_payload, headers=auth_headers)
            assert res_prop.status_code == 201, res_prop.text
            prop = res_prop.json()
            prop_id = prop["id"]
            assert prop["ward_id"] == "DHK-001"

            # Associate property to organization in database
            async with AsyncSessionLocal() as session:
                await session.execute(
                    text("UPDATE properties SET organization_id = :org_id WHERE id = :id"),
                    {"org_id": org_a_id, "id": prop_id},
                )
                await session.commit()

            # -----------------------------------------------------------------
            # STAGE 2 — Permanent Hazard Location Registration
            # -----------------------------------------------------------------
            loc_code = f"ACME-ROOF-{uuid.uuid4().hex[:4].upper()}"
            loc_payload = {
                "location_code": loc_code,
                "name": "Building B Rooftop Drainage Channel",
                "category": "roof_drain",
                "floor_zone": "Building B - Roof",
                "written_directions": "Stairwell 2 to roof, walk 10m north along solar panel rack.",
                "description": "Perimeter parapet drain with chronic gradient depression.",
            }
            res_loc = await client.post(
                f"/api/sites/properties/{prop_id}/locations",
                json=loc_payload,
                headers=auth_headers,
            )
            assert res_loc.status_code == 201, res_loc.text
            loc = res_loc.json()
            loc_id = loc["id"]
            assert loc["location_code"] == loc_code

            # -----------------------------------------------------------------
            # STAGE 3 — Initial Inspection & Issue Creation
            # -----------------------------------------------------------------
            insp_payload = {
                "inspector_name": "Inspector Kabir",
                "inspector_role": "Authority Inspector",
                "inspection_date": "2026-10-10",
                "result": "problem_found",
                "notes": "Severe pooling of 50mm stagnant water with active mosquito larvae.",
                "problem_identified": "50mm standing water in roof trough",
            }
            res_insp = await client.post(
                f"/api/sites/locations/{loc_id}/inspections",
                json=insp_payload,
                headers=auth_headers,
            )
            assert res_insp.status_code == 201, res_insp.text
            insp = res_insp.json()
            insp_id = insp["id"]

            issue_payload = {
                "inspection_id": insp_id,
                "issue_type": "clogged_drainage",
                "severity": "high",
                "description": "Heavy organic silt and standing water holding Aedes larvae.",
            }
            res_issue = await client.post(
                f"/api/sites/locations/{loc_id}/issues",
                json=issue_payload,
                headers=auth_headers,
            )
            assert res_issue.status_code == 201, res_issue.text
            issue = res_issue.json()
            issue_id = issue["id"]
            assert issue["status"] == "open"

            # -----------------------------------------------------------------
            # STAGE 4 — Initial Service Work Order & Evidence Submission
            # -----------------------------------------------------------------
            wo_payload = {
                "property_id": prop_id,
                "location_id": loc_id,
                "issue_id": issue_id,
                "title": "Clear blocked roof drain trough",
                "required_action": "clean_drain",
                "priority": "high",
                "assigned_worker_id": "W-042",
                "assigned_worker_name": "Rafiqul Islam",
                "responsible_supervisor": "Dr. Shamsul Alam",
                "due_date": "2026-10-15",
                "description": "Drain clearing, silt evacuation, and larvicide application.",
            }
            res_wo = await client.post("/api/services/work-orders", json=wo_payload, headers=auth_headers)
            assert res_wo.status_code == 201, res_wo.text
            wo = res_wo.json()
            wo_id = wo["id"]
            assert wo["status"] == "assigned"

            # Worker starts work
            res_start = await client.post(f"/api/services/work-orders/{wo_id}/start", headers=auth_headers)
            assert res_start.status_code == 200
            assert res_start.json()["status"] == "in_progress"

            # Worker submits evidence
            img_bytes = f"UNIQUE_IMAGE_DATA_{uuid.uuid4().hex}".encode("utf-8")
            evidence_file = ("after_drain.jpg", io.BytesIO(img_bytes), "image/jpeg")
            sub_form_data = {
                "action_type": "Cleaned",
                "work_description": "Cleaned 15m trough and applied Bti granules.",
                "materials_used": "50g Vectobac Bti granules",
                "labor_hours": "2.5",
                "actual_cost": "1800.0",
                "evidence_category": "after_photo",
            }
            res_evidence = await client.post(
                f"/api/services/work-orders/{wo_id}/submit-evidence",
                data=sub_form_data,
                files={"files": evidence_file},
                headers=auth_headers,
            )
            assert res_evidence.status_code == 200, res_evidence.text
            assert res_evidence.json()["status"] == "evidence_submitted"

            # Supervisor reviews & approves service work
            rev_payload = {
                "decision": "accepted",
                "decision_notes": "Drain channel cleared thoroughly. Verified photographically.",
            }
            res_rev = await client.post(
                f"/api/services/work-orders/{wo_id}/review",
                json=rev_payload,
                headers=auth_headers,
            )
            assert res_rev.status_code == 200, res_rev.text
            wo_verified = res_rev.json()
            assert wo_verified["status"] == "work_verified"
            # Resolution is NOT yet confirmed at work verification stage
            assert wo_verified["resolution_verification_status"] == "awaiting_followup"

            # -----------------------------------------------------------------
            # STAGE 5 — Follow-up Inspection & Resolution Confirmation
            # -----------------------------------------------------------------
            # Force evaluate scheduling to generate recommendation for location
            await client.post("/api/scheduling/evaluate", json={"force_reevaluate": True}, headers=auth_headers)
            res_recs = await client.get(f"/api/scheduling/recommendations?location_id={loc_id}", headers=auth_headers)
            assert res_recs.status_code == 200
            recs = res_recs.json()
            if recs:
                rec_id = recs[0]["id"]
                # Manager approves visit
                res_approve_rec = await client.post(
                    f"/api/scheduling/recommendations/{rec_id}/decide",
                    json={
                        "decision": "approved",
                        "approved_date": "2026-10-18",
                        "decision_notes": "Approved for 7-day post-cleanup reinspection."
                    },
                    headers=auth_headers,
                )
                assert res_approve_rec.status_code == 200

            # Record actual follow-up inspection outcome as "clear"
            res_fu_insp = await client.post(
                f"/api/sites/locations/{loc_id}/inspections",
                json={
                    "inspector_name": "Senior Inspector Zahid",
                    "inspector_role": "Authority Inspector",
                    "inspection_date": "2026-10-19",
                    "result": "clear",
                    "notes": "Drain trough completely dry and clear of standing water.",
                },
                headers=auth_headers,
            )
            assert res_fu_insp.status_code == 201

            # Complete scheduled visit if one exists
            res_scheds = await client.get(f"/api/scheduling/scheduled?location_id={loc_id}", headers=auth_headers)
            if res_scheds.status_code == 200 and res_scheds.json():
                sched_id = res_scheds.json()[0]["id"]
                await client.patch(
                    f"/api/scheduling/scheduled/{sched_id}/complete",
                    json={"completed_inspection_id": res_fu_insp.json()["id"], "notes": "Completed and clean"},
                    headers=auth_headers,
                )

            # Confirm issue resolution in services module
            res_res_conf = await client.post(
                f"/api/services/work-orders/{wo_id}/record-followup",
                json={
                    "verified_outcome": "clear",
                    "verification_notes": "Follow-up confirmed complete resolution.",
                    "inspector_name": "Senior Inspector Zahid",
                },
                headers=auth_headers,
            )
            assert res_res_conf.status_code == 200
            assert res_res_conf.json()["resolution_verification_status"] == "resolution_confirmed"

            # -----------------------------------------------------------------
            # STAGE 6 — Recurrence Detection
            # -----------------------------------------------------------------
            # A new rain event occurs and the issue returns later
            new_insp_payload = {
                "inspector_name": "Inspector Kabir",
                "inspector_role": "Authority Inspector",
                "inspection_date": "2026-10-25",
                "result": "problem_found",
                "notes": "Standing water pooled again in identical dip after rain.",
                "problem_identified": "Recurring water ponding",
            }
            res_recurr_insp = await client.post(
                f"/api/sites/locations/{loc_id}/inspections",
                json=new_insp_payload,
                headers=auth_headers,
            )
            assert res_recurr_insp.status_code == 201

            res_recurr_issue = await client.post(
                f"/api/sites/locations/{loc_id}/issues",
                json={
                    "inspection_id": res_recurr_insp.json()["id"],
                    "issue_type": "standing_water",
                    "severity": "high",
                    "description": "Second occurrence of pooling due to structural slope failure.",
                },
                headers=auth_headers,
            )
            assert res_recurr_issue.status_code == 201
            recurr_issue = res_recurr_issue.json()

            # Confirm recurrence links to previous issue
            res_confirm_rec = await client.post(
                f"/api/sites/issues/{recurr_issue['id']}/confirm-recurrence",
                json={"previous_issue_id": issue_id, "confirmed_by": "Inspector Kabir"},
                headers=auth_headers,
            )
            assert res_confirm_rec.status_code == 200
            assert bool(res_confirm_rec.json().get("is_recurrence")) is True

            # -----------------------------------------------------------------
            # STAGE 7 — Additional Service & Documented Maintenance Expense
            # -----------------------------------------------------------------
            cost_payload = {
                "property_id": prop_id,
                "location_id": loc_id,
                "cost_category": "services",
                "amount": 2500.0,
                "currency": "BDT",
                "expense_date": "2026-10-26",
                "description": "Manual pumping and repeated larvicide application",
                "invoice_ref": "INV-ACME-PUMP-01",
                "status": "verified",
            }
            res_cost = await client.post("/api/repair-planning/costs", json=cost_payload, headers=auth_headers)
            assert res_cost.status_code == 201

            # -----------------------------------------------------------------
            # STAGE 8 — Repair Opportunity Identification
            # -----------------------------------------------------------------
            res_opps = await client.get("/api/repair-planning/opportunities", headers=auth_headers)
            assert res_opps.status_code == 200
            opps = res_opps.json()
            assert isinstance(opps, list)

            # -----------------------------------------------------------------
            # STAGE 9 — Technical Assessment, Quotations, Scenarios, and Approval
            # -----------------------------------------------------------------
            # 1. Technical assessment
            assess_payload = {
                "property_id": prop_id,
                "location_id": loc_id,
                "assessor_name": "Engr. M. Rahman",
                "assessor_role": "Structural Drainage Consultant",
                "assessment_date": "2026-10-27",
                "problem_description": "Sagging roof drainage channel with defective gradient.",
                "suspected_root_cause": "Undersized bracket supports and concrete spalling.",
                "observations": "Water pools constantly after rain.",
                "recommended_action": "Install heavy-duty galvanized bracket supports and correct fall gradient.",
                "feasibility": "repair_feasible",
                "safety_considerations": "Roof edge safety netting required.",
            }
            res_assess = await client.post("/api/repair-planning/assessments", json=assess_payload, headers=auth_headers)
            assert res_assess.status_code == 201

            # 2. Repair proposal
            prop_payload = {
                "property_id": prop_id,
                "location_id": loc_id,
                "title": "Permanent Roof Drainage Channel Realignment",
                "description": "Structural realignment and anti-ponding lining.",
                "responsible_assessor": "Engr. M. Rahman",
                "proposed_method": "Galvanized brackets + slope mortar + waterproof lining",
                "expected_service_life_years": 7.0,
                "expected_maintenance_after_per_month": 0.0,
                "safety_considerations": "Full harness safety line",
                "operational_interruption_hours": 3.0,
            }
            res_prop_repair = await client.post("/api/repair-planning/proposals", json=prop_payload, headers=auth_headers)
            assert res_prop_repair.status_code == 201
            proposal = res_prop_repair.json()
            proposal_id = proposal["id"]

            # 3. Attach supplier quotation
            quote_payload = {
                "supplier_name": "Bengal Engineering & Waterproofing Co.",
                "quote_reference": "Q-BEW-2026-88",
                "quoted_amount": 10000.0,
                "currency": "BDT",
                "valid_until": "2026-12-31",
                "scope_of_work": "Complete channel realignment, galvanized brackets, and seal",
                "warranty_months": 24,
                "lead_time_days": 3,
                "is_preferred": True,
            }
            res_quote = await client.post(
                f"/api/repair-planning/proposals/{proposal_id}/quotations",
                json=quote_payload,
                headers=auth_headers,
            )
            assert res_quote.status_code == 201
            quote_id = res_quote.json()["id"]

            # 4. Financial calculation (3-scenario calculation)
            res_scen = await client.post(
                f"/api/repair-planning/proposals/{proposal_id}/calculate?quotation_id={quote_id}&evaluation_period_months=12",
                headers=auth_headers,
            )
            assert res_scen.status_code == 200
            scen_data = res_scen.json()
            assert "expected_scenario" in scen_data or "expected" in scen_data

            # 5. Manager Approval
            res_approve_prop = await client.post(
                f"/api/repair-planning/proposals/{proposal_id}/approve",
                json={
                    "quotation_id": quote_id,
                    "decision": "approved",
                    "decision_notes": "Approved based on attractive payback.",
                    "approved_budget": 10000.0,
                },
                headers=auth_headers,
            )
            assert res_approve_prop.status_code == 201
            assert res_approve_prop.json()["decision"] == "approved"

            # -----------------------------------------------------------------
            # STAGE 10 — Repair Implementation via Service Work Order
            # -----------------------------------------------------------------
            res_convert = await client.post(
                f"/api/repair-planning/proposals/{proposal_id}/create-work-order",
                json={
                    "assigned_worker_name": "Specialist Repair Crew",
                    "due_date": "2026-10-28",
                    "responsible_supervisor": "Dr. Shamsul Alam",
                },
                headers=auth_headers,
            )
            assert res_convert.status_code == 200
            rep_wo = res_convert.json()
            rep_wo_id = rep_wo["id"]

            # Start and submit completion evidence for repair
            await client.post(f"/api/services/work-orders/{rep_wo_id}/start", headers=auth_headers)
            repair_evidence = ("realignment_complete.jpg", io.BytesIO(f"REPAIR_{uuid.uuid4().hex}".encode("utf-8")), "image/jpeg")
            await client.post(
                f"/api/services/work-orders/{rep_wo_id}/submit-evidence",
                data={
                    "action_type": "Cleaned",
                    "work_description": "Installed galvanized brackets and re-sloped trough to 1:50.",
                    "materials_used": "Galvanized brackets, polymer mortar, waterproof seal",
                    "labor_hours": "6.0",
                    "actual_cost": "10000.0",
                    "evidence_category": "after_photo",
                },
                files={"files": repair_evidence},
                headers=auth_headers,
            )
            res_rep_review = await client.post(
                f"/api/services/work-orders/{rep_wo_id}/review",
                json={
                    "decision": "accepted",
                    "decision_notes": "Repair verified per engineering specifications.",
                },
                headers=auth_headers,
            )
            assert res_rep_review.status_code == 200
            assert res_rep_review.json()["status"] == "work_verified"

            # -----------------------------------------------------------------
            # STAGE 11 — After-Repair Post-Inspection Outcome
            # -----------------------------------------------------------------
            res_outcome = await client.get(
                f"/api/repair-planning/proposals/{proposal_id}/outcomes",
                headers=auth_headers,
            )
            assert res_outcome.status_code == 200
            outcome_data = res_outcome.json()
            assert outcome_data["proposal_id"] == proposal_id

            # -----------------------------------------------------------------
            # STAGE 12 — Coordinated Prevention Across Properties
            # -----------------------------------------------------------------
            # 1. Create coordination group
            grp_payload = {
                "name": "Mirpur Sector 12 Industrial Dengue Prevention Taskforce",
                "group_type": "industrial_park",
                "managing_org_id": org_a_id,
                "coordinator_name": "Dr. Tariq Anam",
                "description": "Cross-property consortium coordinating shared drainage corridors.",
            }
            res_grp = await client.post("/api/coordination/groups", json=grp_payload, headers=auth_headers)
            assert res_grp.status_code == 201, res_grp.text
            group = res_grp.json()
            group_id = group["id"]

            # 2. Register Organization B
            org_b_payload = {
                "name": "Delta Garments Spinning Mills",
                "org_type": "factory_company",
                "authorized_representative": "Engr. Kamal Hossain",
                "representative_role": "Factory Manager",
                "contact_person": "Engr. Kamal Hossain",
                "contact_phone": "+880 1711-223344",
                "contact_email": "kamal@deltaspinning.bd",
                "address": "Plot 16, Industrial Zone, Mirpur, Dhaka",
            }
            res_org_b = await client.post("/api/organizations", json=org_b_payload, headers=auth_headers)
            assert res_org_b.status_code == 201, res_org_b.text
            org_b_id = res_org_b.json()["id"]

            # 3. Invite Organization B and accept
            inv_payload = {
                "group_id": group_id,
                "invited_org_id": org_b_id,
                "inviting_org_id": org_a_id,
                "invited_by_name": "Dr. Tariq Anam",
                "message": "Please join the perimeter industrial canal dengue prevention taskforce.",
            }
            res_inv = await client.post(
                "/api/coordination/invitations",
                json=inv_payload,
                headers=auth_headers,
            )
            assert res_inv.status_code == 201, res_inv.text
            inv_id = res_inv.json()["id"]

            res_accept_inv = await client.post(
                f"/api/coordination/invitations/{inv_id}/decide",
                json={"decision": "accept", "decision_by_name": "Engr. Kamal Hossain"},
                headers=auth_headers,
            )
            assert res_accept_inv.status_code == 200
            assert res_accept_inv.json()["status"] == "accepted"

            # 4. Register shared perimeter boundary area
            shared_area_payload = {
                "group_id": group_id,
                "name": "Acme-Delta Boundary Stormwater Culvert",
                "area_type": "drainage_corridor",
                "description": "Perimeter ditch running along Acme East boundary and Delta West fence.",
                "latitude": 23.8110,
                "longitude": 90.3695,
                "responsible_org_id": org_a_id,
            }
            res_shared_area = await client.post(
                f"/api/coordination/groups/{group_id}/shared-areas",
                json=shared_area_payload,
                headers=auth_headers,
            )
            assert res_shared_area.status_code == 201, res_shared_area.text
            shared_area = res_shared_area.json()
            shared_area_id = shared_area["id"]

            # 5. Schedule a shared-area inspection
            shared_test_date = (date.today() + timedelta(days=30 + (uuid.uuid4().int % 200))).isoformat()
            shared_insp_payload = {
                "shared_area_id": shared_area_id,
                "scheduled_date": shared_test_date,
                "assigned_inspector": "Taskforce Joint Inspector",
                "created_by": "Dr. Tariq Anam",
                "notes": "Bi-weekly joint inspection of perimeter drainage.",
            }
            res_shared_insp = await client.post(
                f"/api/coordination/groups/{group_id}/shared-inspections",
                json=shared_insp_payload,
                headers=auth_headers,
            )
            assert res_shared_insp.status_code == 201, res_shared_insp.text
            assert res_shared_insp.json()["status"] == "scheduled"

            # 6. Schedule shared maintenance work order
            shared_wo_date = (date.today() + timedelta(days=35 + (uuid.uuid4().int % 200))).isoformat()
            shared_wo_payload = {
                "shared_area_id": shared_area_id,
                "title": "Clear perimeter stormwater culvert silt",
                "required_action": "Excavate silt deposits and clear overgrowth",
                "priority": "high",
                "assigned_worker_name": "Contractor Field Crew 1",
                "assigned_contractor": "Dhaka Canal Cleaning Services",
                "responsible_supervisor": "Dr. Shamsul Alam",
                "due_date": shared_wo_date,
                "description": "Clear silt and overgrowth in shared culvert.",
            }
            res_shared_wo = await client.post(
                f"/api/coordination/groups/{group_id}/shared-work-orders",
                json=shared_wo_payload,
                headers=auth_headers,
            )
            assert res_shared_wo.status_code == 201, res_shared_wo.text
            assert res_shared_wo.json()["status"] == "assigned"
            assert res_shared_wo.json()["shared_area_id"] == shared_area_id

            # -----------------------------------------------------------------
            # STAGE 13 — Multi-Tenant Privacy and Access Boundaries
            # -----------------------------------------------------------------
            # 1. Factory A dashboard shows Acme's properties
            res_dash_a = await client.get(f"/api/organizations/{org_a_id}/dashboard", headers=auth_headers)
            assert res_dash_a.status_code == 200
            dash_a = res_dash_a.json()
            assert any(p["id"] == prop_id for p in dash_a["properties"])

            # 2. Factory B dashboard does NOT contain Factory A's private property
            res_dash_b = await client.get(f"/api/organizations/{org_b_id}/dashboard", headers=auth_headers)
            assert res_dash_b.status_code == 200
            dash_b = res_dash_b.json()
            assert not any(p["id"] == prop_id for p in dash_b["properties"])

            # 3. Both see the shared area in consortium listing
            res_areas = await client.get(f"/api/coordination/groups/{group_id}/shared-areas", headers=auth_headers)
            assert res_areas.status_code == 200
            assert any(a["id"] == shared_area_id for a in res_areas.json())

            # 4. Shared repairs endpoint does NOT leak confidential quotations to other orgs
            res_shared_repairs = await client.get(
                f"/api/coordination/groups/{group_id}/repairs",
                params={"requester_org_id": org_b_id},
                headers=auth_headers,
            )
            assert res_shared_repairs.status_code == 200
            for rep in res_shared_repairs.json():
                assert "supplier_quotations" not in rep
                assert "internal_margins" not in rep

            # -----------------------------------------------------------------
            # STAGE 14 — Persistence Verification
            # -----------------------------------------------------------------
            # Directly query the database to prove all entities exist on disk
            async with AsyncSessionLocal() as session:
                prop_count = (await session.execute(text("SELECT COUNT(*) FROM properties WHERE id = :id"), {"id": prop_id})).scalar_one()
                assert prop_count == 1, "Property was not persisted!"

                loc_count = (await session.execute(text("SELECT COUNT(*) FROM permanent_hazard_locations WHERE id = :id"), {"id": loc_id})).scalar_one()
                assert loc_count == 1, "Hazard location was not persisted!"

                insp_count = (await session.execute(text("SELECT COUNT(*) FROM location_inspections WHERE id = :id"), {"id": insp_id})).scalar_one()
                assert insp_count == 1, "Inspection was not persisted!"

                issue_count = (await session.execute(text("SELECT COUNT(*) FROM location_issues WHERE id = :id"), {"id": issue_id})).scalar_one()
                assert issue_count == 1, "Issue was not persisted!"

                wo_count = (await session.execute(text("SELECT COUNT(*) FROM service_work_orders WHERE id = :id"), {"id": wo_id})).scalar_one()
                assert wo_count == 1, "Work order was not persisted!"

                prop_repair_count = (await session.execute(text("SELECT COUNT(*) FROM repair_proposals WHERE id = :id"), {"id": proposal_id})).scalar_one()
                assert prop_repair_count == 1, "Repair proposal was not persisted!"

                group_count = (await session.execute(text("SELECT COUNT(*) FROM coordination_groups WHERE id = :id"), {"id": group_id})).scalar_one()
                assert group_count == 1, "Coordination group was not persisted!"

                shared_count = (await session.execute(text("SELECT COUNT(*) FROM shared_areas WHERE id = :id"), {"id": shared_area_id})).scalar_one()
                assert shared_count == 1, "Shared area was not persisted!"
