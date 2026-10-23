"""
Service for Improvement 04 — Financial Comparison Engine & Post-Repair Outcome Monitoring.
Performs transparent mathematical modeling comparing continued periodic cleanup against
permanent capital repairs under Optimistic, Expected, and Cautious scenarios.
Enforces audit guardrails, manages approval decisions, and tracks post-repair actual outcomes.
"""

from datetime import datetime, date, timedelta, timezone
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RepairCostAnalyzer:
    @classmethod
    async def calculate_financial_scenarios(
        cls,
        db: AsyncSession,
        proposal_id: str,
        quotation_id: str,
        evaluation_period_months: int = 12,
    ) -> Dict[str, Any]:
        """
        Generate transparent, explainable 3-scenario financial comparison:
        - Optimistic (95% cost reduction)
        - Expected (Assessor documented target reduction)
        - Cautious (50% reduction + ongoing maintenance contingency)
        """
        # 1. Fetch proposal and location details
        prop_res = await db.execute(
            text("""
                SELECT p.*, l.location_code, l.name AS location_name, prop.name AS property_name
                FROM repair_proposals p
                JOIN permanent_hazard_locations l ON p.location_id = l.id
                JOIN properties prop ON p.property_id = prop.id
                WHERE p.id = :pid
            """),
            {"pid": proposal_id},
        )
        proposal = prop_res.mappings().first()
        if not proposal:
            raise ValueError(f"Repair proposal '{proposal_id}' not found.")

        # 2. Fetch quotation
        quote_res = await db.execute(
            text("SELECT * FROM supplier_quotations WHERE id = :qid AND proposal_id = :pid"),
            {"qid": quotation_id, "pid": proposal_id},
        )
        quotation = quote_res.mappings().first()
        if not quotation:
            raise ValueError(f"Supplier quotation '{quotation_id}' not found for proposal '{proposal_id}'.")

        loc_id = proposal["location_id"]
        repair_investment = float(quotation["quoted_amount"])
        currency = quotation["currency"] or "BDT"

        # 3. Calculate baseline recurring monthly maintenance cost
        # Query maintenance cost entries for the location
        costs_res = await db.execute(
            text("""
                SELECT amount, expense_date
                FROM maintenance_cost_entries
                WHERE location_id = :loc_id
                ORDER BY expense_date ASC
            """),
            {"loc_id": loc_id},
        )
        cost_rows = costs_res.mappings().all()

        missing_warnings = []
        if len(cost_rows) >= 2:
            total_historical = sum(r["amount"] for r in cost_rows)
            # Estimate observation span in months
            d1 = datetime.strptime(cost_rows[0]["expense_date"][:10], "%Y-%m-%d").date()
            d2 = datetime.strptime(cost_rows[-1]["expense_date"][:10], "%Y-%m-%d").date()
            days_span = max(30, (d2 - d1).days)
            obs_months = max(1, round(days_span / 30.4))
            baseline_monthly = total_historical / obs_months
        else:
            # Fallback to service work orders actual_cost
            wo_res = await db.execute(
                text("SELECT SUM(actual_cost), COUNT(*) FROM service_work_orders WHERE location_id = :loc_id AND actual_cost > 0"),
                {"loc_id": loc_id},
            )
            wo_row = wo_res.fetchone()
            total_historical = wo_row[0] if (wo_row and wo_row[0]) else 0.0
            wo_count = wo_row[1] if wo_row else 0
            obs_months = max(1, min(6, wo_count * 2))
            baseline_monthly = (total_historical / obs_months) if total_historical > 0 else 2000.0
            if total_historical == 0.0:
                missing_warnings.append("Historical maintenance cost records are limited. Baseline estimated at ৳2,000/month based on standard drain cleanup rate.")

        baseline_monthly = round(baseline_monthly, 2)
        total_historical = round(total_historical, 2)

        # Baseline cost over evaluation period without repair
        cum_without_repair = round(baseline_monthly * evaluation_period_months, 2)

        # --- SCENARIO A: OPTIMISTIC ---
        # 95% reduction in recurring costs (essentially complete permanent fix)
        opt_reduction_pct = 95.0
        opt_remaining_monthly = round(baseline_monthly * 0.05, 2)
        opt_monthly_savings = round(baseline_monthly - opt_remaining_monthly, 2)
        opt_payback = round(repair_investment / opt_monthly_savings, 1) if opt_monthly_savings > 0 else None
        opt_cum_with_repair = round(repair_investment + (opt_remaining_monthly * evaluation_period_months), 2)
        opt_net_savings = round(cum_without_repair - opt_cum_with_repair, 2)
        opt_roi = round((opt_net_savings / repair_investment) * 100, 1) if repair_investment > 0 else 0.0

        optimistic_result = {
            "scenario_name": "Optimistic",
            "description": "Full permanent problem elimination. 95% of future recurring cleanups avoided.",
            "assumed_cost_reduction_pct": opt_reduction_pct,
            "expected_maintenance_after_per_month": opt_remaining_monthly,
            "monthly_savings": opt_monthly_savings,
            "simple_payback_months": opt_payback,
            "cumulative_cost_without_repair": cum_without_repair,
            "cumulative_cost_with_repair": opt_cum_with_repair,
            "net_savings_over_period": opt_net_savings,
            "roi_pct": opt_roi,
            "is_financially_viable": opt_net_savings > 0,
            "assumptions_summary": f"Assumes complete elimination of chronic ponding. Only ৳{opt_remaining_monthly}/month for annual inspection contingency.",
        }

        # --- SCENARIO B: EXPECTED (Documented Target) ---
        # Uses assessor's expected ongoing maintenance after repair
        exp_remaining_monthly = float(proposal["expected_maintenance_after_per_month"] or 0.0)
        # If assessor entered 0, assume standard 15% ongoing upkeep
        if exp_remaining_monthly == 0.0:
            exp_remaining_monthly = round(baseline_monthly * 0.15, 2)

        exp_monthly_savings = max(0.0, round(baseline_monthly - exp_remaining_monthly, 2))
        exp_reduction_pct = round(((baseline_monthly - exp_remaining_monthly) / max(1.0, baseline_monthly)) * 100, 1)
        exp_payback = round(repair_investment / exp_monthly_savings, 1) if exp_monthly_savings > 0 else None
        exp_cum_with_repair = round(repair_investment + (exp_remaining_monthly * evaluation_period_months), 2)
        exp_net_savings = round(cum_without_repair - exp_cum_with_repair, 2)
        exp_roi = round((exp_net_savings / repair_investment) * 100, 1) if repair_investment > 0 else 0.0

        expected_result = {
            "scenario_name": "Expected",
            "description": "Target engineering specification. Gutter regraded with minor scheduled inspections.",
            "assumed_cost_reduction_pct": exp_reduction_pct,
            "expected_maintenance_after_per_month": exp_remaining_monthly,
            "monthly_savings": exp_monthly_savings,
            "simple_payback_months": exp_payback,
            "cumulative_cost_without_repair": cum_without_repair,
            "cumulative_cost_with_repair": exp_cum_with_repair,
            "net_savings_over_period": exp_net_savings,
            "roi_pct": exp_roi,
            "is_financially_viable": exp_net_savings > 0,
            "assumptions_summary": f"Assumes engineering target of ৳{exp_remaining_monthly}/month ongoing maintenance under {quotation['warranty_months']}-month warranty.",
        }

        # --- SCENARIO C: CAUTIOUS (Conservative Risk Contingency) ---
        # Assumes only 50% cost reduction + minor ongoing maintenance contingency
        caut_reduction_pct = 50.0
        caut_remaining_monthly = round(baseline_monthly * 0.50 + 200.0, 2)
        caut_monthly_savings = max(0.0, round(baseline_monthly - caut_remaining_monthly, 2))
        caut_payback = round(repair_investment / caut_monthly_savings, 1) if caut_monthly_savings > 0 else None
        caut_cum_with_repair = round(repair_investment + (caut_remaining_monthly * evaluation_period_months), 2)
        caut_net_savings = round(cum_without_repair - caut_cum_with_repair, 2)
        caut_roi = round((caut_net_savings / repair_investment) * 100, 1) if repair_investment > 0 else 0.0

        cautious_result = {
            "scenario_name": "Cautious",
            "description": "Conservative scenario. Partial mitigation with seasonal leaf clearing still required.",
            "assumed_cost_reduction_pct": caut_reduction_pct,
            "expected_maintenance_after_per_month": caut_remaining_monthly,
            "monthly_savings": caut_monthly_savings,
            "simple_payback_months": caut_payback,
            "cumulative_cost_without_repair": cum_without_repair,
            "cumulative_cost_with_repair": caut_cum_with_repair,
            "net_savings_over_period": caut_net_savings,
            "roi_pct": caut_roi,
            "is_financially_viable": caut_net_savings > 0,
            "assumptions_summary": f"Assumes seasonal monsoon buildup still requires partial cleanings totaling ৳{caut_remaining_monthly}/month.",
        }

        caveat_statement = (
            "DISCLAIMER & DECISION-SUPPORT NOTICE: Calculations are based on historical service visit logs, "
            "qualified technical assessments, and documented supplier quotations. Estimated outcome — not guaranteed. "
            "Health and public safety obligations take precedence over financial payback."
        )

        return {
            "proposal_id": proposal_id,
            "quotation_id": quotation_id,
            "supplier_name": quotation["supplier_name"],
            "quoted_amount": repair_investment,
            "currency": currency,
            "evaluation_period_months": evaluation_period_months,
            "baseline_observation_months": obs_months,
            "baseline_total_recorded_cost": total_historical,
            "baseline_monthly_recurring_cost": baseline_monthly,
            "optimistic_scenario": optimistic_result,
            "expected_scenario": expected_result,
            "cautious_scenario": cautious_result,
            "caveat_statement": caveat_statement,
            "missing_data_warnings": missing_warnings,
        }

    @classmethod
    async def save_financial_scenario(
        cls,
        db: AsyncSession,
        proposal_id: str,
        quotation_id: str,
        evaluation_period_months: int,
        assumptions_notes: Optional[str],
        created_by: str,
        is_approved_baseline: bool = False,
    ) -> Dict[str, Any]:
        """Save a modeled financial scenario snapshot to the database."""
        calc = await cls.calculate_financial_scenarios(
            db=db,
            proposal_id=proposal_id,
            quotation_id=quotation_id,
            evaluation_period_months=evaluation_period_months,
        )

        scen_id = f"SCEN-{uuid.uuid4().hex[:8].upper()}"
        now_str = _now_iso()

        # If setting as approved baseline, unmark existing baselines for this proposal
        if is_approved_baseline:
            await db.execute(
                text("UPDATE repair_financial_scenarios SET is_approved_baseline = 0 WHERE proposal_id = :pid"),
                {"pid": proposal_id},
            )

        await db.execute(
            text("""
                INSERT INTO repair_financial_scenarios
                (id, proposal_id, quotation_id, evaluation_period_months,
                 baseline_monthly_cost, repair_investment,
                 optimistic_monthly_savings, optimistic_payback_months,
                 expected_monthly_savings, expected_payback_months,
                 cautious_monthly_savings, cautious_payback_months,
                 scenario_assumptions, is_approved_baseline, created_by, created_at)
                VALUES
                (:id, :pid, :qid, :eval_m,
                 :base_m, :inv,
                 :opt_s, :opt_pb,
                 :exp_s, :exp_pb,
                 :caut_s, :caut_pb,
                 :notes, :is_base, :by, :now)
            """),
            {
                "id": scen_id,
                "pid": proposal_id,
                "qid": quotation_id,
                "eval_m": evaluation_period_months,
                "base_m": calc["baseline_monthly_recurring_cost"],
                "inv": calc["quoted_amount"],
                "opt_s": calc["optimistic_scenario"]["monthly_savings"],
                "opt_pb": calc["optimistic_scenario"]["simple_payback_months"],
                "exp_s": calc["expected_scenario"]["monthly_savings"],
                "exp_pb": calc["expected_scenario"]["simple_payback_months"],
                "caut_s": calc["cautious_scenario"]["monthly_savings"],
                "caut_pb": calc["cautious_scenario"]["simple_payback_months"],
                "notes": assumptions_notes or f"Modeled over {evaluation_period_months} months with {calc['supplier_name']} quotation.",
                "is_base": 1 if is_approved_baseline else 0,
                "by": created_by,
                "now": now_str,
            }
        )
        await db.commit()

        # Fetch and return saved record
        res = await db.execute(text("SELECT * FROM repair_financial_scenarios WHERE id = :id"), {"id": scen_id})
        row = res.mappings().first()
        return dict(row)

    @classmethod
    async def record_approval_decision(
        cls,
        db: AsyncSession,
        proposal_id: str,
        quotation_id: str,
        decision: str,
        decision_notes: str,
        reviewer_name: str,
        reviewer_role: str,
        approved_budget: Optional[float] = None,
        scenario_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record formal manager approval, rejection, or request for information."""
        appr_id = f"APPR-{uuid.uuid4().hex[:8].upper()}"
        now_str = _now_iso()

        # Fetch quotation amount if budget not explicitly passed
        if approved_budget is None:
            q_res = await db.execute(
                text("SELECT quoted_amount FROM supplier_quotations WHERE id = :qid"),
                {"qid": quotation_id},
            )
            q_row = q_res.first()
            approved_budget = q_row[0] if q_row else 0.0

        await db.execute(
            text("""
                INSERT INTO repair_approval_decisions
                (id, proposal_id, quotation_id, scenario_id, reviewer_name,
                 reviewer_role, decision, decision_notes, approved_budget, decided_at, created_at)
                VALUES
                (:id, :pid, :qid, :sid, :name,
                 :role, :decision, :notes, :budget, :now, :now)
            """),
            {
                "id": appr_id,
                "pid": proposal_id,
                "qid": quotation_id,
                "sid": scenario_id,
                "name": reviewer_name,
                "role": reviewer_role,
                "decision": decision,
                "notes": decision_notes,
                "budget": float(approved_budget),
                "now": now_str,
            }
        )

        # Update proposal status
        new_status = "approved" if decision == "approved" else ("rejected" if decision == "rejected" else "awaiting_assessment")
        await db.execute(
            text("""
                UPDATE repair_proposals
                SET status = :st, approved_quotation_id = :qid, updated_at = :now
                WHERE id = :pid
            """),
            {"st": new_status, "qid": quotation_id if decision == "approved" else None, "now": now_str, "pid": proposal_id},
        )

        # Update quotation status
        if decision == "approved":
            await db.execute(
                text("UPDATE supplier_quotations SET status = 'selected', updated_at = :now WHERE id = :qid"),
                {"now": now_str, "qid": quotation_id},
            )
            # Other quotes marked as rejected
            await db.execute(
                text("UPDATE supplier_quotations SET status = 'rejected', updated_at = :now WHERE proposal_id = :pid AND id != :qid"),
                {"now": now_str, "pid": proposal_id, "qid": quotation_id},
            )

        await db.commit()

        res = await db.execute(text("SELECT * FROM repair_approval_decisions WHERE id = :id"), {"id": appr_id})
        return dict(res.mappings().first())

    @classmethod
    async def list_saved_scenarios(cls, db: AsyncSession, proposal_id: str) -> List[Dict[str, Any]]:
        """Retrieve historical saved scenario snapshots for a proposal."""
        res = await db.execute(
            text("""
                SELECT s.*, q.supplier_name, q.quoted_amount
                FROM repair_financial_scenarios s
                JOIN supplier_quotations q ON s.quotation_id = q.id
                WHERE s.proposal_id = :pid
                ORDER BY s.created_at DESC
            """),
            {"pid": proposal_id},
        )
        return [dict(r) for r in res.mappings().all()]

    @classmethod
    async def list_approval_decisions(cls, db: AsyncSession, proposal_id: str) -> List[Dict[str, Any]]:
        """Retrieve managerial decision audit log for a proposal."""
        res = await db.execute(
            text("""
                SELECT a.*, q.supplier_name
                FROM repair_approval_decisions a
                JOIN supplier_quotations q ON a.quotation_id = q.id
                WHERE a.proposal_id = :pid
                ORDER BY a.decided_at DESC
            """),
            {"pid": proposal_id},
        )
        return [dict(r) for r in res.mappings().all()]

    @classmethod
    async def create_implementation_work_order(
        cls,
        db: AsyncSession,
        proposal_id: str,
        assigned_worker_name: str,
        due_date: str,
        responsible_supervisor: str,
        user_name: str,
    ) -> Dict[str, Any]:
        """
        Convert an approved permanent repair proposal into an executable service work order
        inside Improvement 03 infrastructure.
        """
        prop_res = await db.execute(
            text("""
                SELECT p.*, q.quoted_amount, q.supplier_name
                FROM repair_proposals p
                LEFT JOIN supplier_quotations q ON p.approved_quotation_id = q.id
                WHERE p.id = :pid
            """),
            {"pid": proposal_id},
        )
        proposal = prop_res.mappings().first()
        if not proposal:
            raise ValueError(f"Repair proposal '{proposal_id}' not found.")
        if proposal["status"] != "approved":
            raise ValueError(f"Cannot create work order for proposal in '{proposal['status']}' status. Must be 'approved'.")

        wo_id = f"WO-REP-{uuid.uuid4().hex[:6].upper()}"
        now_str = _now_iso()

        # Insert work order in Improvement 03 table
        await db.execute(
            text("""
                INSERT INTO service_work_orders
                (id, property_id, location_id, title, description,
                 required_action, priority, assigned_worker_name, assigned_contractor,
                 responsible_supervisor, due_date, status, resolution_verification_status,
                 labor_hours, actual_cost, currency, repair_classification,
                 created_at, updated_at)
                VALUES
                (:id, :prop_id, :loc_id, :title, :desc,
                 'repair_component', 'high', :worker, :contractor,
                 :supervisor, :due, 'assigned', 'awaiting_followup',
                 8.0, :cost, 'BDT', 'permanent_repair',
                 :now, :now)
            """),
            {
                "id": wo_id,
                "prop_id": proposal["property_id"],
                "loc_id": proposal["location_id"],
                "title": f"Permanent Repair: {proposal['title']}",
                "desc": f"{proposal['description']} | Proposed Method: {proposal['proposed_method']}",
                "worker": assigned_worker_name,
                "contractor": proposal["supplier_name"] or "Contractor Services",
                "supervisor": responsible_supervisor,
                "due": due_date,
                "cost": float(proposal["quoted_amount"] or 0.0),
                "now": now_str,
            }
        )

        # Update proposal with implemented work order reference
        await db.execute(
            text("UPDATE repair_proposals SET implemented_work_order_id = :wo_id, status = 'implemented', updated_at = :now WHERE id = :pid"),
            {"wo_id": wo_id, "now": now_str, "pid": proposal_id},
        )

        # Insert initial status history
        await db.execute(
            text("""
                INSERT INTO work_order_status_history
                (id, work_order_id, from_status, to_status, changed_by, changed_at, notes)
                VALUES
                (:id, :wo_id, NULL, 'assigned', :by, :now, :notes)
            """),
            {
                "id": f"WOSH-{uuid.uuid4().hex[:8].upper()}",
                "wo_id": wo_id,
                "by": user_name,
                "now": now_str,
                "notes": f"Launched implementation work order from approved repair proposal #{proposal_id}.",
            }
        )

        await db.commit()

        # Return work order detail
        from services.service_verifier import ServiceVerifier
        return await ServiceVerifier.get_work_order_detail(db, wo_id)

    @classmethod
    async def track_post_repair_outcomes(cls, db: AsyncSession, proposal_id: str) -> Dict[str, Any]:
        """
        Compare forecast financial savings with actual post-repair performance using
        real follow-up inspection records and expense entries.
        """
        prop_res = await db.execute(
            text("""
                SELECT p.*, l.location_code, l.name AS location_name, prop.name AS property_name,
                       q.quoted_amount, q.currency
                FROM repair_proposals p
                JOIN permanent_hazard_locations l ON p.location_id = l.id
                JOIN properties prop ON p.property_id = prop.id
                LEFT JOIN supplier_quotations q ON p.approved_quotation_id = q.id
                WHERE p.id = :pid
            """),
            {"pid": proposal_id},
        )
        proposal = prop_res.mappings().first()
        if not proposal:
            raise ValueError("Repair proposal not found.")

        loc_id = proposal["location_id"]
        wo_id = proposal["implemented_work_order_id"]
        approved_quote = float(proposal["quoted_amount"] or 0.0)
        currency = proposal["currency"] or "BDT"

        # Check if work order was completed
        completion_date = None
        actual_repair_cost = approved_quote

        if wo_id:
            wo_res = await db.execute(
                text("SELECT status, completed_at, actual_cost FROM service_work_orders WHERE id = :id"),
                {"id": wo_id},
            )
            wo_row = wo_res.mappings().first()
            if wo_row and wo_row["completed_at"]:
                completion_date = wo_row["completed_at"]
                actual_repair_cost = float(wo_row["actual_cost"] or approved_quote)

        # If not implemented or no completion date, return pending message
        if not completion_date:
            return {
                "proposal_id": proposal_id,
                "proposal_title": proposal["title"],
                "location_id": loc_id,
                "location_code": proposal["location_code"],
                "location_name": proposal["location_name"],
                "property_id": proposal["property_id"],
                "property_name": proposal["property_name"],
                "repair_completed_at": None,
                "approved_quote_amount": approved_quote,
                "actual_repair_cost": 0.0,
                "cost_variance": 0.0,
                "currency": currency,
                "days_since_completion": 0,
                "post_repair_inspections_count": 0,
                "post_repair_recurrences_count": 0,
                "post_repair_maintenance_spend": 0.0,
                "predicted_monthly_savings": 0.0,
                "observed_monthly_spend": 0.0,
                "realized_savings_to_date": None,
                "is_outcome_verified": False,
                "status_summary": "Repair not yet completed or verified on site. Post-repair tracking begins following service verification.",
            }

        # Calculate days elapsed since completion
        comp_dt = datetime.fromisoformat(completion_date.replace("Z", "+00:00"))
        days_elapsed = max(1, (datetime.now(timezone.utc) - comp_dt).days)
        months_elapsed = max(0.1, days_elapsed / 30.4)

        # 1. Query follow-up inspections conducted AFTER completion date
        insp_res = await db.execute(
            text("""
                SELECT COUNT(*)
                FROM location_inspections
                WHERE location_id = :loc_id AND inspection_date >= :comp_d
            """),
            {"loc_id": loc_id, "comp_d": completion_date[:10]},
        )
        post_inspections = insp_res.scalar() or 0

        # Also check resolution verification records
        res_verif_res = await db.execute(
            text("SELECT COUNT(*) FROM resolution_verification_records WHERE location_id = :loc_id AND verified_at >= :comp_t"),
            {"loc_id": loc_id, "comp_t": completion_date},
        )
        res_verif_count = res_verif_res.scalar() or 0
        total_post_checks = post_inspections + res_verif_count

        # 2. Query any new issues reported AFTER completion date
        issue_res = await db.execute(
            text("""
                SELECT COUNT(*)
                FROM location_issues
                WHERE location_id = :loc_id AND observed_at >= :comp_t
            """),
            {"loc_id": loc_id, "comp_t": completion_date},
        )
        post_recurrences = issue_res.scalar() or 0

        # 3. Query maintenance expenses logged AFTER completion date
        post_cost_res = await db.execute(
            text("""
                SELECT SUM(amount)
                FROM maintenance_cost_entries
                WHERE location_id = :loc_id AND expense_date >= :comp_d
            """),
            {"loc_id": loc_id, "comp_d": completion_date[:10]},
        )
        post_spend = post_cost_res.scalar() or 0.0

        # Get predicted savings from baseline scenario
        scen_res = await db.execute(
            text("SELECT expected_monthly_savings, baseline_monthly_cost FROM repair_financial_scenarios WHERE proposal_id = :pid ORDER BY is_approved_baseline DESC, created_at DESC LIMIT 1"),
            {"pid": proposal_id},
        )
        scen_row = scen_res.mappings().first()
        pred_monthly_savings = scen_row["expected_monthly_savings"] if scen_row else 1500.0
        baseline_monthly = scen_row["baseline_monthly_cost"] if scen_row else 2000.0

        observed_monthly_spend = round(post_spend / months_elapsed, 2)
        cost_variance = round(actual_repair_cost - approved_quote, 2)

        # Realized savings to date = (Baseline cost expected to date) - (Actual post spend)
        expected_spend_without_repair = baseline_monthly * months_elapsed
        realized_savings = round(expected_spend_without_repair - post_spend, 2)

        # Determine verification status
        is_verified = (days_elapsed >= 14 and total_post_checks >= 1)
        if not is_verified:
            status_summary = f"Monitoring active: {days_elapsed} days elapsed since repair. More follow-up observations required for definitive outcome verification."
        elif post_recurrences == 0 and post_spend == 0.0:
            status_summary = (
                f"Resolution confirmed across {total_post_checks} follow-up checks. Zero recurrences detected. "
                f"Observed maintenance cost is ৳0/mo compared to historical ৳{baseline_monthly:.0f}/mo baseline."
            )
        else:
            status_summary = (
                f"{post_recurrences} recurring findings logged post-repair. Recorded post-repair spending: ৳{post_spend:,.0f}. "
                f"Intervention yielded partial mitigation."
            )

        return {
            "proposal_id": proposal_id,
            "proposal_title": proposal["title"],
            "location_id": loc_id,
            "location_code": proposal["location_code"],
            "location_name": proposal["location_name"],
            "property_id": proposal["property_id"],
            "property_name": proposal["property_name"],
            "repair_completed_at": completion_date,
            "approved_quote_amount": approved_quote,
            "actual_repair_cost": actual_repair_cost,
            "cost_variance": cost_variance,
            "currency": currency,
            "days_since_completion": days_elapsed,
            "post_repair_inspections_count": total_post_checks,
            "post_repair_recurrences_count": post_recurrences,
            "post_repair_maintenance_spend": round(post_spend, 2),
            "predicted_monthly_savings": round(pred_monthly_savings, 2),
            "observed_monthly_spend": observed_monthly_spend,
            "realized_savings_to_date": realized_savings if is_verified else None,
            "is_outcome_verified": is_verified,
            "status_summary": status_summary,
        }
