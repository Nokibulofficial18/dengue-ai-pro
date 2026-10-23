"""
Service for Improvement 04 — Identifying Recurring-Cost Opportunities and Historical Maintenance.
Analyzes permanent hazard locations with repeated confirmed problems, computes historical
maintenance expenditures, evaluates data completeness, and generates explainable review triggers.
"""

from datetime import datetime, date, timezone
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RepairOpportunityService:
    @classmethod
    async def record_cost_entry(
        cls,
        db: AsyncSession,
        data: Dict[str, Any],
        entered_by: str,
    ) -> Dict[str, Any]:
        """Record a single maintenance or repair expense item."""
        cost_id = f"COST-{uuid.uuid4().hex[:8].upper()}"
        now_str = _now_iso()

        # Validate that location and property exist
        loc_row = (
            await db.execute(
                text("SELECT id, property_id FROM permanent_hazard_locations WHERE id = :id"),
                {"id": data["location_id"]},
            )
        ).mappings().first()
        if not loc_row:
            raise ValueError(f"Referenced hazard location '{data['location_id']}' does not exist.")

        property_id = data.get("property_id") or loc_row["property_id"]

        await db.execute(
            text("""
                INSERT INTO maintenance_cost_entries
                (id, property_id, location_id, work_order_id, cost_category,
                 amount, currency, expense_date, description, invoice_ref,
                 entered_by, status, created_at, updated_at)
                VALUES
                (:id, :prop_id, :loc_id, :wo_id, :cat,
                 :amount, :curr, :exp_date, :desc, :inv,
                 :entered_by, :status, :now, :now)
            """),
            {
                "id": cost_id,
                "prop_id": property_id,
                "loc_id": data["location_id"],
                "wo_id": data.get("work_order_id"),
                "cat": data["cost_category"],
                "amount": float(data["amount"]),
                "curr": data.get("currency", "BDT"),
                "exp_date": data["expense_date"],
                "desc": data.get("description"),
                "inv": data.get("invoice_ref"),
                "entered_by": entered_by,
                "status": data.get("status", "recorded"),
                "now": now_str,
            }
        )

        # If linked to a work order, optionally update the work order actual_cost
        if data.get("work_order_id"):
            tot_wo_res = await db.execute(
                text("SELECT SUM(amount) FROM maintenance_cost_entries WHERE work_order_id = :wo_id"),
                {"wo_id": data["work_order_id"]},
            )
            tot_wo_amount = tot_wo_res.scalar() or float(data["amount"])
            await db.execute(
                text("UPDATE service_work_orders SET actual_cost = :tot, updated_at = :now WHERE id = :wo_id"),
                {"tot": tot_wo_amount, "now": now_str, "wo_id": data["work_order_id"]},
            )

        await db.commit()
        return await cls.get_cost_entry(db, cost_id)

    @classmethod
    async def get_cost_entry(cls, db: AsyncSession, cost_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve full details of a single maintenance cost entry."""
        res = await db.execute(
            text("""
                SELECT c.*, p.name AS property_name, l.location_code, l.name AS location_name
                FROM maintenance_cost_entries c
                JOIN properties p ON c.property_id = p.id
                JOIN permanent_hazard_locations l ON c.location_id = l.id
                WHERE c.id = :id
            """),
            {"id": cost_id},
        )
        row = res.mappings().first()
        return dict(row) if row else None

    @classmethod
    async def get_location_cost_summary(cls, db: AsyncSession, location_id: str) -> Dict[str, Any]:
        """Aggregate all historical maintenance expenses for a hazard location."""
        loc_res = await db.execute(
            text("""
                SELECT l.id, l.location_code, l.name AS location_name, p.id AS property_id, p.name AS property_name
                FROM permanent_hazard_locations l
                JOIN properties p ON l.property_id = p.id
                WHERE l.id = :loc_id
            """),
            {"loc_id": location_id},
        )
        loc = loc_res.mappings().first()
        if not loc:
            raise ValueError("Hazard location not found.")

        cost_res = await db.execute(
            text("""
                SELECT c.*, p.name AS property_name, l.location_code, l.name AS location_name
                FROM maintenance_cost_entries c
                JOIN properties p ON c.property_id = p.id
                JOIN permanent_hazard_locations l ON c.location_id = l.id
                WHERE c.location_id = :loc_id
                ORDER BY c.expense_date DESC, c.created_at DESC
            """),
            {"loc_id": location_id},
        )
        entries = [dict(r) for r in cost_res.mappings().all()]

        # Compute category breakdown and totals
        total_cost = sum(e["amount"] for e in entries)
        verified_cost = sum(e["amount"] for e in entries if e["status"] == "verified")
        estimated_cost = sum(e["amount"] for e in entries if e["status"] == "estimated")

        cat_breakdown: Dict[str, float] = {}
        for e in entries:
            cat = e["cost_category"]
            cat_breakdown[cat] = cat_breakdown.get(cat, 0.0) + e["amount"]

        # Also count service work orders for visit frequency
        wo_count_res = await db.execute(
            text("SELECT COUNT(*) FROM service_work_orders WHERE location_id = :loc_id AND status != 'cancelled'"),
            {"loc_id": location_id},
        )
        total_visits = wo_count_res.scalar() or 0

        # Fallback: if maintenance_cost_entries is empty, inspect service_work_orders.actual_cost
        if total_cost == 0.0 and total_visits > 0:
            wo_cost_res = await db.execute(
                text("SELECT SUM(actual_cost) FROM service_work_orders WHERE location_id = :loc_id AND actual_cost > 0"),
                {"loc_id": location_id},
            )
            fallback_sum = wo_cost_res.scalar() or 0.0
            if fallback_sum > 0:
                total_cost = fallback_sum
                estimated_cost = fallback_sum

        first_date = entries[-1]["expense_date"] if entries else None
        latest_date = entries[0]["expense_date"] if entries else None

        avg_visit_cost = round(total_cost / max(1, total_visits), 2) if total_visits > 0 else 0.0

        return {
            "location_id": loc["id"],
            "location_code": loc["location_code"],
            "location_name": loc["location_name"],
            "property_id": loc["property_id"],
            "property_name": loc["property_name"],
            "total_recorded_cost": round(total_cost, 2),
            "verified_cost": round(verified_cost, 2),
            "estimated_cost": round(estimated_cost, 2),
            "currency": "BDT",
            "total_service_visits": total_visits,
            "cost_bearing_visits": len([e for e in entries if e["amount"] > 0]),
            "average_cost_per_visit": avg_visit_cost,
            "first_expense_date": first_date,
            "latest_expense_date": latest_date,
            "cost_by_category": cat_breakdown,
            "entries": entries,
        }

    @classmethod
    async def get_repair_opportunities(
        cls,
        db: AsyncSession,
        property_id: Optional[str] = None,
        ward_id: Optional[str] = None,
        min_recurrences: int = 1,
        min_spend: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Identify hazard locations with recurring issues and maintenance spending that may
        merit a permanent repair assessment.
        """
        query_parts = [
            """
            SELECT l.id AS location_id, l.location_code, l.name AS location_name,
                   l.category, p.id AS property_id, p.name AS property_name,
                   p.ward_id
            FROM permanent_hazard_locations l
            JOIN properties p ON l.property_id = p.id
            WHERE l.status = 'active'
            """
        ]
        params: Dict[str, Any] = {}

        if property_id and property_id != "all":
            query_parts.append("AND l.property_id = :prop_id")
            params["prop_id"] = property_id
        if ward_id and ward_id != "all":
            query_parts.append("AND p.ward_id = :ward_id")
            params["ward_id"] = ward_id

        loc_rows = (await db.execute(text(" ".join(query_parts)), params)).mappings().all()

        opportunities = []
        for loc in loc_rows:
            loc_id = loc["location_id"]

            # 1. Count confirmed recurrences and issues
            issues_res = await db.execute(
                text("""
                    SELECT COUNT(*) AS total_issues,
                           SUM(CASE WHEN is_recurrence = 1 THEN 1 ELSE 0 END) AS rec_count,
                           MAX(observed_at) AS latest_date
                    FROM location_issues
                    WHERE location_id = :loc_id
                """),
                {"loc_id": loc_id},
            )
            issue_stats = issues_res.mappings().first()
            total_issues = issue_stats["total_issues"] or 0
            rec_count = issue_stats["rec_count"] or 0
            latest_issue_date = issue_stats["latest_date"]

            # Effective recurrence indicator: confirmed recurrences or repeat findings (>1)
            effective_recurrence = rec_count if rec_count > 0 else (total_issues - 1 if total_issues > 1 else 0)

            # 2. Count verified service work orders and total cost
            wo_res = await db.execute(
                text("""
                    SELECT COUNT(*) AS total_wo,
                           SUM(CASE WHEN status = 'work_verified' THEN 1 ELSE 0 END) AS verified_wo,
                           SUM(actual_cost) AS wo_total_cost
                    FROM service_work_orders
                    WHERE location_id = :loc_id AND status != 'cancelled'
                """),
                {"loc_id": loc_id},
            )
            wo_stats = wo_res.mappings().first()
            verified_visits = wo_stats["verified_wo"] or 0
            wo_cost = wo_stats["wo_total_cost"] or 0.0

            # 3. Query direct entries from maintenance_cost_entries
            cost_entries_res = await db.execute(
                text("SELECT SUM(amount), COUNT(*) FROM maintenance_cost_entries WHERE location_id = :loc_id"),
                {"loc_id": loc_id},
            )
            direct_cost_row = cost_entries_res.fetchone()
            direct_cost = direct_cost_row[0] if (direct_cost_row and direct_cost_row[0] is not None) else 0.0
            direct_entries_count = direct_cost_row[1] if direct_cost_row else 0

            # Consolidated spend
            total_spend = max(direct_cost, wo_cost)

            # If it doesn't meet minimum recurrence or spend filter, skip
            if effective_recurrence < min_recurrences and total_spend < min_spend:
                continue

            # 4. Check Technical Assessment status
            assess_res = await db.execute(
                text("""
                    SELECT id, feasibility, assessment_date
                    FROM repair_assessments
                    WHERE location_id = :loc_id
                    ORDER BY assessment_date DESC, created_at DESC
                    LIMIT 1
                """),
                {"loc_id": loc_id},
            )
            assess_row = assess_res.mappings().first()
            has_assessment = assess_row is not None
            latest_assess_id = assess_row["id"] if assess_row else None
            latest_feasibility = assess_row["feasibility"] if assess_row else None

            # 5. Check Repair Proposals and Supplier Quotes
            prop_res = await db.execute(
                text("""
                    SELECT id, status
                    FROM repair_proposals
                    WHERE location_id = :loc_id
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {"loc_id": loc_id},
            )
            prop_row = prop_res.mappings().first()
            has_proposal = prop_row is not None
            latest_prop_id = prop_row["id"] if prop_row else None
            latest_prop_status = prop_row["status"] if prop_row else None

            # Check quotes
            quotes_res = await db.execute(
                text("""
                    SELECT q.id, q.quoted_amount
                    FROM supplier_quotations q
                    JOIN repair_proposals p ON q.proposal_id = p.id
                    WHERE p.location_id = :loc_id AND q.status != 'rejected'
                    ORDER BY q.quoted_amount ASC
                    LIMIT 1
                """),
                {"loc_id": loc_id},
            )
            quote_row = quotes_res.mappings().first()
            has_quote = quote_row is not None
            lowest_quote = quote_row["quoted_amount"] if quote_row else None

            # 6. Determine Decision-Support Category & Explanation
            missing_warnings = []
            if total_spend == 0.0:
                missing_warnings.append("No reliable maintenance cost records logged yet.")
            if not has_assessment:
                missing_warnings.append("Requires qualified engineering/maintenance assessment.")
            if has_proposal and not has_quote:
                missing_warnings.append("Proposal created but awaiting supplier quotations.")

            # Decision Category Logic
            if not has_assessment:
                if total_spend > 0:
                    category_label = "needs_technical_assessment"
                    explanation = (
                        f"Location has {effective_recurrence} repeat issues with ৳{total_spend:,.0f} in recorded maintenance. "
                        f"A qualified maintenance engineer should assess if a lasting structural repair is feasible."
                    )
                else:
                    category_label = "needs_cost_data"
                    explanation = (
                        f"Location has {effective_recurrence} repeat issues, but invoice cost records are missing. "
                        f"Log historical visit expenses before evaluating capital repair investment."
                    )
            elif not has_proposal or not has_quote:
                category_label = "ready_for_financial_review"
                explanation = (
                    f"Technical assessment completed ({latest_feasibility.replace('_', ' ')}). "
                    f"Awaiting supplier quotations to generate financial comparison scenarios."
                )
            else:
                # We have a quote! Estimate quick payback ratio
                # Assume monthly recurring basis ~ total_spend / 4 months
                est_monthly = max(500.0, total_spend / 4.0)
                quick_payback = lowest_quote / est_monthly if est_monthly > 0 else 999.0
                if quick_payback <= 18.0:
                    category_label = "financially_promising"
                    explanation = (
                        f"Technical assessment on file. Supplier quote available (৳{lowest_quote:,.0f}). "
                        f"Under documented assumptions, estimated simple payback is ~{quick_payback:.1f} months."
                    )
                else:
                    category_label = "financially_unfavorable"
                    explanation = (
                        f"Technical assessment on file. Supplier quote (৳{lowest_quote:,.0f}) indicates payback "
                        f"exceeding ~{quick_payback:.1f} months. Periodic maintenance may remain more economical."
                    )

            opportunities.append({
                "location_id": loc["location_id"],
                "location_code": loc["location_code"],
                "location_name": loc["location_name"],
                "category": loc["category"],
                "property_id": loc["property_id"],
                "property_name": loc["property_name"],
                "ward_id": loc["ward_id"],
                "confirmed_recurrence_count": effective_recurrence,
                "verified_service_visits": verified_visits,
                "total_maintenance_spend": round(total_spend, 2),
                "average_monthly_spend": round(total_spend / 4.0, 2) if total_spend > 0 else 0.0,
                "currency": "BDT",
                "latest_issue_date": latest_issue_date,
                "latest_issue_status": "open" if total_issues > 0 else "resolved",
                "has_technical_assessment": has_assessment,
                "latest_assessment_id": latest_assess_id,
                "latest_assessment_feasibility": latest_feasibility,
                "has_repair_proposal": has_proposal,
                "latest_proposal_id": latest_prop_id,
                "latest_proposal_status": latest_prop_status,
                "has_supplier_quotation": has_quote,
                "lowest_quote_amount": lowest_quote,
                "decision_support_category": category_label,
                "explanation": explanation,
                "missing_data_warnings": missing_warnings,
            })

        # Sort by total spending and recurrence count descending
        opportunities.sort(key=lambda x: (x["confirmed_recurrence_count"] > 0, x["total_maintenance_spend"]), reverse=True)
        return opportunities

    @classmethod
    async def get_portfolio_economics(cls, db: AsyncSession) -> Dict[str, Any]:
        """Aggregate high-level capital planning and maintenance economics across portfolio."""
        # 1. Total locations and recurring spend
        loc_count = (await db.execute(text("SELECT COUNT(*) FROM permanent_hazard_locations WHERE status = 'active'"))).scalar() or 0
        total_costs_res = await db.execute(text("SELECT SUM(amount) FROM maintenance_cost_entries"))
        total_spend = total_costs_res.scalar() or 0.0

        # If maintenance_cost_entries has limited data, include work orders
        wo_spend = (await db.execute(text("SELECT SUM(actual_cost) FROM service_work_orders"))).scalar() or 0.0
        portfolio_total_spend = max(total_spend, wo_spend)

        # 2. Proposals summary
        prop_res = await db.execute(
            text("""
                SELECT
                    COUNT(*) AS total_proposals,
                    SUM(CASE WHEN status IN ('draft', 'awaiting_assessment') THEN 1 ELSE 0 END) AS awaiting_assess,
                    SUM(CASE WHEN status IN ('ready_for_financial_review', 'awaiting_approval') THEN 1 ELSE 0 END) AS awaiting_appr,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                    SUM(CASE WHEN status = 'implemented' THEN 1 ELSE 0 END) AS implemented
                FROM repair_proposals
            """)
        )
        prop_stats = prop_res.mappings().first()

        # 3. Approved repair budget & forecast savings
        approved_budget_res = await db.execute(
            text("SELECT SUM(approved_budget) FROM repair_approval_decisions WHERE decision = 'approved'")
        )
        approved_investment = approved_budget_res.scalar() or 0.0

        # 4. Forecasted savings from approved scenarios
        savings_res = await db.execute(
            text("SELECT SUM(expected_monthly_savings * 12) FROM repair_financial_scenarios WHERE is_approved_baseline = 1")
        )
        forecast_annual_savings = savings_res.scalar() or 0.0

        # 5. Post repair spending
        post_repair_res = await db.execute(
            text("""
                SELECT SUM(c.amount)
                FROM maintenance_cost_entries c
                JOIN repair_proposals p ON c.location_id = p.location_id
                WHERE p.status = 'implemented'
            """)
        )
        post_repair_spend = post_repair_res.scalar() or 0.0

        # 6. Property breakdown
        props_res = await db.execute(
            text("""
                SELECT p.id, p.name,
                       COUNT(DISTINCT l.id) AS location_count,
                       COALESCE(SUM(c.amount), 0.0) AS maintenance_spend
                FROM properties p
                LEFT JOIN permanent_hazard_locations l ON p.id = l.property_id
                LEFT JOIN maintenance_cost_entries c ON l.id = c.location_id
                GROUP BY p.id, p.name
            """)
        )
        property_breakdown = [
            {
                "property_id": r["id"],
                "property_name": r["name"],
                "location_count": r["location_count"],
                "maintenance_spend": round(r["maintenance_spend"], 2),
            }
            for r in props_res.mappings().all()
        ]

        return {
            "total_locations_tracked": loc_count,
            "locations_with_recurring_costs": len([p for p in property_breakdown if p["maintenance_spend"] > 0]),
            "total_historical_maintenance_spend": round(portfolio_total_spend, 2),
            "currency": "BDT",
            "total_repair_proposals": prop_stats["total_proposals"] or 0,
            "proposals_awaiting_assessment": prop_stats["awaiting_assess"] or 0,
            "proposals_awaiting_approval": prop_stats["awaiting_appr"] or 0,
            "approved_repairs_count": prop_stats["approved"] or 0,
            "implemented_repairs_count": prop_stats["implemented"] or 0,
            "total_approved_repair_investment": round(approved_investment, 2),
            "total_forecasted_annual_savings": round(forecast_annual_savings, 2),
            "total_actual_post_repair_spend": round(post_repair_spend, 2),
            "property_breakdown": property_breakdown,
        }

    # ========================================================================
    # TECHNICAL ASSESSMENTS
    # ========================================================================
    @classmethod
    async def record_technical_assessment(
        cls,
        db: AsyncSession,
        data: Dict[str, Any],
        user_name: str,
    ) -> Dict[str, Any]:
        """Record an in-person engineering assessment by a qualified maintenance professional."""
        assess_id = f"ASSESS-{uuid.uuid4().hex[:8].upper()}"
        now_str = _now_iso()

        # Validate location & property
        loc_res = await db.execute(
            text("SELECT id, property_id FROM permanent_hazard_locations WHERE id = :id"),
            {"id": data["location_id"]},
        )
        loc = loc_res.mappings().first()
        if not loc:
            raise ValueError(f"Hazard location '{data['location_id']}' not found.")

        property_id = data.get("property_id") or loc["property_id"]

        await db.execute(
            text("""
                INSERT INTO repair_assessments
                (id, property_id, location_id, issue_id, assessor_name,
                 assessor_role, assessment_date, problem_description, suspected_root_cause,
                 observations, recommended_action, feasibility, safety_considerations,
                 additional_investigations, created_at, updated_at)
                VALUES
                (:id, :prop_id, :loc_id, :iss_id, :name,
                 :role, :date, :desc, :cause,
                 :obs, :action, :feas, :safety,
                 :addl, :now, :now)
            """),
            {
                "id": assess_id,
                "prop_id": property_id,
                "loc_id": data["location_id"],
                "iss_id": data.get("issue_id"),
                "name": data["assessor_name"],
                "role": data["assessor_role"],
                "date": data["assessment_date"],
                "desc": data["problem_description"],
                "cause": data["suspected_root_cause"],
                "obs": data.get("observations"),
                "action": data["recommended_action"],
                "feas": data.get("feasibility", "repair_feasible"),
                "safety": data.get("safety_considerations"),
                "addl": data.get("additional_investigations"),
                "now": now_str,
            },
        )
        await db.commit()
        return await cls.get_assessment_by_id(db, assess_id)

    @classmethod
    async def get_assessment_by_id(cls, db: AsyncSession, assess_id: str) -> Optional[Dict[str, Any]]:
        """Fetch single technical assessment with property and location details."""
        res = await db.execute(
            text("""
                SELECT a.*, p.name AS property_name, l.location_code, l.name AS location_name
                FROM repair_assessments a
                JOIN properties p ON a.property_id = p.id
                JOIN permanent_hazard_locations l ON a.location_id = l.id
                WHERE a.id = :id
            """),
            {"id": assess_id},
        )
        row = res.mappings().first()
        return dict(row) if row else None

    @classmethod
    async def get_assessments(
        cls,
        db: AsyncSession,
        location_id: Optional[str] = None,
        property_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List technical assessments filtered by location or property."""
        conditions = []
        params = {}
        if location_id and location_id != "all":
            conditions.append("a.location_id = :loc_id")
            params["loc_id"] = location_id
        if property_id and property_id != "all":
            conditions.append("a.property_id = :prop_id")
            params["prop_id"] = property_id

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        res = await db.execute(
            text(f"""
                SELECT a.*, p.name AS property_name, l.location_code, l.name AS location_name
                FROM repair_assessments a
                JOIN properties p ON a.property_id = p.id
                JOIN permanent_hazard_locations l ON a.location_id = l.id
                {where_clause}
                ORDER BY a.assessment_date DESC, a.created_at DESC
            """),
            params,
        )
        return [dict(r) for r in res.mappings().all()]

    # ========================================================================
    # REPAIR PROPOSALS
    # ========================================================================
    @classmethod
    async def create_repair_proposal(
        cls,
        db: AsyncSession,
        data: Dict[str, Any],
        user_name: str,
    ) -> Dict[str, Any]:
        """Create a new proposed permanent repair alternative."""
        prop_id = f"PROP-{uuid.uuid4().hex[:8].upper()}"
        now_str = _now_iso()

        loc_res = await db.execute(
            text("SELECT id, property_id FROM permanent_hazard_locations WHERE id = :id"),
            {"id": data["location_id"]},
        )
        loc = loc_res.mappings().first()
        if not loc:
            raise ValueError(f"Hazard location '{data['location_id']}' not found.")

        property_id = data.get("property_id") or loc["property_id"]
        initial_status = "ready_for_financial_review" if data.get("assessment_id") else "draft"

        await db.execute(
            text("""
                INSERT INTO repair_proposals
                (id, property_id, location_id, assessment_id, title,
                 description, responsible_assessor, proposed_method, expected_service_life_years,
                 expected_maintenance_after_per_month, safety_considerations,
                 operational_interruption_hours, status, created_at, updated_at)
                VALUES
                (:id, :prop_id, :loc_id, :assess_id, :title,
                 :desc, :assessor, :method, :life,
                 :maint_after, :safety,
                 :interruption, :status, :now, :now)
            """),
            {
                "id": prop_id,
                "prop_id": property_id,
                "loc_id": data["location_id"],
                "assess_id": data.get("assessment_id"),
                "title": data["title"],
                "desc": data["description"],
                "assessor": data["responsible_assessor"],
                "method": data["proposed_method"],
                "life": float(data.get("expected_service_life_years", 5.0)),
                "maint_after": float(data.get("expected_maintenance_after_per_month", 0.0)),
                "safety": data.get("safety_considerations"),
                "interruption": float(data.get("operational_interruption_hours", 0.0)),
                "status": initial_status,
                "now": now_str,
            },
        )
        await db.commit()
        return await cls.get_repair_proposal(db, prop_id)

    @classmethod
    async def get_repair_proposal(cls, db: AsyncSession, proposal_id: str) -> Optional[Dict[str, Any]]:
        """Fetch proposal detail with attached quotations and assessment metadata."""
        res = await db.execute(
            text("""
                SELECT p.*, pr.name AS property_name, l.location_code, l.name AS location_name,
                       a.feasibility AS assessment_feasibility
                FROM repair_proposals p
                JOIN properties pr ON p.property_id = pr.id
                JOIN permanent_hazard_locations l ON p.location_id = l.id
                LEFT JOIN repair_assessments a ON p.assessment_id = a.id
                WHERE p.id = :id
            """),
            {"id": proposal_id},
        )
        row = res.mappings().first()
        if not row:
            return None

        p_dict = dict(row)

        # Attach quotations
        q_res = await db.execute(
            text("SELECT * FROM supplier_quotations WHERE proposal_id = :pid ORDER BY quoted_amount ASC"),
            {"pid": proposal_id},
        )
        p_dict["quotations"] = [dict(q) for q in q_res.mappings().all()]
        return p_dict

    @classmethod
    async def list_repair_proposals(
        cls,
        db: AsyncSession,
        property_id: Optional[str] = None,
        status: Optional[str] = None,
        location_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List proposals with attached quotations."""
        conditions = []
        params = {}
        if property_id and property_id != "all":
            conditions.append("p.property_id = :prop_id")
            params["prop_id"] = property_id
        if status and status != "all":
            conditions.append("p.status = :status")
            params["status"] = status
        if location_id and location_id != "all":
            conditions.append("p.location_id = :loc_id")
            params["loc_id"] = location_id

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        res = await db.execute(
            text(f"""
                SELECT p.*, pr.name AS property_name, l.location_code, l.name AS location_name,
                       a.feasibility AS assessment_feasibility
                FROM repair_proposals p
                JOIN properties pr ON p.property_id = pr.id
                JOIN permanent_hazard_locations l ON p.location_id = l.id
                LEFT JOIN repair_assessments a ON p.assessment_id = a.id
                {where_clause}
                ORDER BY p.created_at DESC
            """),
            params,
        )
        proposals = [dict(r) for r in res.mappings().all()]

        # Attach quotations for each
        for prop in proposals:
            q_res = await db.execute(
                text("SELECT * FROM supplier_quotations WHERE proposal_id = :pid ORDER BY quoted_amount ASC"),
                {"pid": prop["id"]},
            )
            prop["quotations"] = [dict(q) for q in q_res.mappings().all()]

        return proposals

    @classmethod
    async def update_repair_proposal(
        cls,
        db: AsyncSession,
        proposal_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """Update proposal attributes."""
        allowed_fields = [
            "title", "description", "proposed_method", "expected_service_life_years",
            "expected_maintenance_after_per_month", "safety_considerations",
            "operational_interruption_hours", "status"
        ]
        set_clauses = []
        params: Dict[str, Any] = {"pid": proposal_id, "now": _now_iso()}

        for field in allowed_fields:
            if field in updates and updates[field] is not None:
                set_clauses.append(f"{field} = :{field}")
                params[field] = updates[field]

        if not set_clauses:
            return await cls.get_repair_proposal(db, proposal_id)

        set_clauses.append("updated_at = :now")
        await db.execute(
            text(f"UPDATE repair_proposals SET {', '.join(set_clauses)} WHERE id = :pid"),
            params,
        )
        await db.commit()
        return await cls.get_repair_proposal(db, proposal_id)

    # ========================================================================
    # SUPPLIER QUOTATIONS
    # ========================================================================
    @classmethod
    async def add_supplier_quotation(
        cls,
        db: AsyncSession,
        proposal_id: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Attach a supplier quotation to a repair proposal."""
        q_id = f"QUOTE-{uuid.uuid4().hex[:8].upper()}"
        now_str = _now_iso()

        # Verify proposal exists
        prop = await cls.get_repair_proposal(db, proposal_id)
        if not prop:
            raise ValueError(f"Repair proposal '{proposal_id}' does not exist.")

        await db.execute(
            text("""
                INSERT INTO supplier_quotations
                (id, proposal_id, supplier_name, quoted_amount, currency,
                 scope_of_work, included_materials, excluded_costs, lead_time_days,
                 valid_until, warranty_months, status, created_at, updated_at)
                VALUES
                (:id, :pid, :supplier, :amount, :curr,
                 :scope, :mats, :excl, :lead,
                 :valid, :warranty, 'active', :now, :now)
            """),
            {
                "id": q_id,
                "pid": proposal_id,
                "supplier": data["supplier_name"],
                "amount": float(data["quoted_amount"]),
                "curr": data.get("currency", "BDT"),
                "scope": data["scope_of_work"],
                "mats": data.get("included_materials"),
                "excl": data.get("excluded_costs"),
                "lead": int(data.get("lead_time_days", 7)),
                "valid": data["valid_until"],
                "warranty": int(data.get("warranty_months", 12)),
                "now": now_str,
            },
        )

        # Advance proposal status if it was draft
        if prop["status"] in ("draft", "awaiting_assessment"):
            await db.execute(
                text("UPDATE repair_proposals SET status = 'ready_for_financial_review', updated_at = :now WHERE id = :pid"),
                {"now": now_str, "pid": proposal_id},
            )

        await db.commit()

        res = await db.execute(text("SELECT * FROM supplier_quotations WHERE id = :id"), {"id": q_id})
        return dict(res.mappings().first())

    @classmethod
    async def list_supplier_quotations(cls, db: AsyncSession, proposal_id: str) -> List[Dict[str, Any]]:
        """List all quotations submitted for a proposal."""
        res = await db.execute(
            text("SELECT * FROM supplier_quotations WHERE proposal_id = :pid ORDER BY quoted_amount ASC"),
            {"pid": proposal_id},
        )
        return [dict(r) for r in res.mappings().all()]
