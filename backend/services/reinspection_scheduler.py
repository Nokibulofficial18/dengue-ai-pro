"""
Smart Reinspection Scheduling Service (Improvement 02).
Provides explainable, deterministic, rule-based scheduling intelligence
evaluating permanent hazard locations against their longitudinal history,
recurrence patterns, post-resolution statuses, and verified rainfall observations.
"""

from datetime import datetime, date, timedelta, timezone
import json
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_str() -> str:
    return date.today().isoformat()


def _parse_date(d_str: str) -> Optional[date]:
    if not d_str:
        return None
    try:
        if "T" in d_str:
            return datetime.fromisoformat(d_str.replace("Z", "+00:00")).date()
        return date.fromisoformat(d_str[:10])
    except Exception:
        return None


class ReinspectionScheduler:
    """
    Core engine for calculating explainable reinspection recommendations.
    Deterministic, transparent rules that prepare the foundation for future ML models.
    """

    @staticmethod
    async def get_effective_policy(
        db: AsyncSession,
        property_id: str,
        location_category: str
    ) -> Dict[str, Any]:
        """
        Determine effective inspection policy with hierarchical precedence:
        1. Category-specific policy for property
        2. Property-wide policy
        3. Category-specific global policy
        4. Global default baseline policy
        """
        # Try finding property-scoped or category-scoped active policy
        query = text("""
            SELECT id, name, scope_type, scope_id, location_category,
                   normal_interval_days, recurrence_followup_days,
                   resolution_followup_days, rainfall_threshold_mm,
                   max_interval_days, is_active
            FROM inspection_policies
            WHERE is_active = 1
            ORDER BY
                CASE
                    WHEN scope_type = 'property' AND scope_id = :prop_id AND location_category = :cat THEN 1
                    WHEN scope_type = 'property' AND scope_id = :prop_id THEN 2
                    WHEN scope_type = 'global' AND location_category = :cat THEN 3
                    WHEN scope_type = 'global' AND location_category = 'all' THEN 4
                    ELSE 5
                END ASC
            LIMIT 1
        """)
        result = await db.execute(query, {"prop_id": property_id, "cat": location_category})
        row = result.mappings().first()

        if row:
            return dict(row)

        # Fallback default hardcoded guardrail policy if none seeded
        return {
            "id": "POL-FALLBACK",
            "name": "Standard Default Protocol",
            "scope_type": "global",
            "scope_id": None,
            "location_category": "all",
            "normal_interval_days": 14,
            "recurrence_followup_days": 5,
            "resolution_followup_days": 7,
            "rainfall_threshold_mm": 25.0,
            "max_interval_days": 30,
            "is_active": 1,
        }

    @classmethod
    async def evaluate_location(
        cls,
        db: AsyncSession,
        location_id: str,
        force_reevaluate: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluate a single permanent hazard location and generate an explainable
        recommendation if justified by history, recurrence, weather, or routine schedule.
        Idempotent: prevents duplicate active proposed recommendations.
        """
        # 1. Fetch location details
        loc_res = await db.execute(
            text("""
                SELECT l.id, l.property_id, l.location_code, l.name, l.category,
                       l.status, l.created_at, p.ward_id, p.name AS property_name
                FROM permanent_hazard_locations l
                JOIN properties p ON l.property_id = p.id
                WHERE l.id = :loc_id
            """),
            {"loc_id": location_id}
        )
        loc = loc_res.mappings().first()
        if not loc or loc["status"] != "active":
            return None

        today = date.today()
        policy = await cls.get_effective_policy(db, loc["property_id"], loc["category"])

        # 2. Check for existing active approved scheduled visits
        upcoming_visit_res = await db.execute(
            text("""
                SELECT id, scheduled_date
                FROM scheduled_inspections
                WHERE location_id = :loc_id AND status = 'approved' AND scheduled_date >= :today
                ORDER BY scheduled_date ASC
                LIMIT 1
            """),
            {"loc_id": location_id, "today": today.isoformat()}
        )
        upcoming_visit = upcoming_visit_res.mappings().first()

        # 3. Fetch location history
        # Inspections
        insp_res = await db.execute(
            text("""
                SELECT id, inspection_date, result, problem_identified, inspector_name
                FROM location_inspections
                WHERE location_id = :loc_id
                ORDER BY inspection_date DESC
            """),
            {"loc_id": location_id}
        )
        inspections = [dict(r) for r in insp_res.mappings().all()]
        last_inspection = inspections[0] if inspections else None
        last_insp_date = _parse_date(last_inspection["inspection_date"]) if last_inspection else None

        # Issues (open, resolved, recurrence)
        issues_res = await db.execute(
            text("""
                SELECT id, issue_type, severity, observed_at, status, resolved_at,
                       is_recurrence, previous_issue_id, recurrence_confirmed_by
                FROM location_issues
                WHERE location_id = :loc_id
                ORDER BY observed_at DESC
            """),
            {"loc_id": location_id}
        )
        issues = [dict(r) for r in issues_res.mappings().all()]
        open_issues = [i for i in issues if i["status"] == "open"]
        recurring_issues = [i for i in issues if i.get("is_recurrence") == 1]
        resolved_issues = [i for i in issues if i["status"] == "resolved" and i.get("resolved_at")]

        # Maintenance activities
        act_res = await db.execute(
            text("""
                SELECT id, activity_type, performed_at, notes, performed_by
                FROM location_activities
                WHERE location_id = :loc_id
                ORDER BY performed_at DESC
                LIMIT 5
            """),
            {"loc_id": location_id}
        )
        activities = [dict(r) for r in act_res.mappings().all()]
        permanent_repairs = [a for a in activities if a["activity_type"] in ("structural_repair", "drainage_flushing")]

        # Recent rainfall observations for this ward/area (last 72 hours)
        cutoff_72h = (datetime.now(timezone.utc) - timedelta(hours=72)).isoformat()
        rain_res = await db.execute(
            text("""
                SELECT id, rainfall_mm, recorded_at, area_description, data_source
                FROM rainfall_observations
                WHERE (ward_id = :ward_id OR ward_id IS NULL)
                  AND recorded_at >= :cutoff
                  AND rainfall_mm >= :thresh
                ORDER BY rainfall_mm DESC, recorded_at DESC
                LIMIT 1
            """),
            {
                "ward_id": loc["ward_id"],
                "cutoff": cutoff_72h,
                "thresh": policy["rainfall_threshold_mm"]
            }
        )
        qualifying_rain = rain_res.mappings().first()

        # 4. Check existing proposed recommendation
        existing_rec_res = await db.execute(
            text("""
                SELECT id, trigger_type, rule_code, recommended_date, status
                FROM reinspection_recommendations
                WHERE location_id = :loc_id AND status = 'proposed'
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"loc_id": location_id}
        )
        existing_rec = existing_rec_res.mappings().first()

        # 5. Rule Evaluation Hierarchy
        candidate_rec: Optional[Dict[str, Any]] = None

        # RULE 1: Confirmed Recurring Hazard (RULE-REC-01)
        if len(recurring_issues) > 0:
            rec_days = policy["recurrence_followup_days"]
            target_date = today + timedelta(days=rec_days)
            # Cap at max interval
            max_date = today + timedelta(days=policy["max_interval_days"])
            if target_date > max_date:
                target_date = max_date

            count = len(recurring_issues)
            explanation = (
                f"Standing water or vector hazard has returned {count} confirmed time(s) at this location. "
                f"Expedited reinspection recommended within {rec_days} days to monitor recurrence."
            )
            supporting = [
                {
                    "record_type": "issue",
                    "record_id": i["id"],
                    "date": i["observed_at"],
                    "summary": f"Recurring {i['issue_type']} ({i['severity']} severity)"
                }
                for i in recurring_issues[:3]
            ]
            if last_inspection:
                supporting.append({
                    "record_type": "inspection",
                    "record_id": last_inspection["id"],
                    "date": last_inspection["inspection_date"],
                    "summary": f"Last result: {last_inspection['result']}"
                })

            candidate_rec = {
                "trigger_type": "recurring_hazard",
                "rule_code": "RULE-REC-01",
                "rule_version": "v1.0",
                "recommended_date": target_date.isoformat(),
                "explanation": explanation,
                "supporting_records": supporting,
                "evidence_level": "sufficient_history",
                "priority": 1,
            }

        # RULE 2: Post-Resolution Verification (RULE-RESOLV-01)
        elif len(resolved_issues) > 0:
            most_recent_resolved = resolved_issues[0]
            resolved_date = _parse_date(most_recent_resolved["resolved_at"])
            has_subsequent_inspection = False
            if last_insp_date and resolved_date and last_insp_date >= resolved_date:
                has_subsequent_inspection = True

            if not has_subsequent_inspection and resolved_date:
                followup_days = policy["resolution_followup_days"]
                target_date = max(today, resolved_date + timedelta(days=followup_days))
                explanation = (
                    f"Issue #{most_recent_resolved['id']} ({most_recent_resolved['issue_type']}) was recently resolved. "
                    f"A follow-up inspection is suggested to confirm that the location remains clear and corrective actions have held."
                )
                supporting = [
                    {
                        "record_type": "issue",
                        "record_id": most_recent_resolved["id"],
                        "date": most_recent_resolved["resolved_at"],
                        "summary": f"Resolved: {most_recent_resolved['issue_type']} ({most_recent_resolved.get('resolution_notes') or 'Cleaned/Fixed'})"
                    }
                ]
                candidate_rec = {
                    "trigger_type": "post_resolution_followup",
                    "rule_code": "RULE-RESOLV-01",
                    "rule_version": "v1.0",
                    "recommended_date": target_date.isoformat(),
                    "explanation": explanation,
                    "supporting_records": supporting,
                    "evidence_level": "sufficient_history",
                    "priority": 2,
                }

        # RULE 3: Rainfall Trigger (RULE-RAIN-02)
        if not candidate_rec and qualifying_rain:
            rain_exposed_categories = {
                "roof_drain", "construction_pit", "open_drain",
                "basement_sump", "container_yard", "water_tank", "other"
            }
            if loc["category"] in rain_exposed_categories or len(issues) > 0:
                rain_date = _parse_date(qualifying_rain["recorded_at"]) or today
                target_date = max(today, rain_date + timedelta(days=2))
                explanation = (
                    f"Significant rainfall of {qualifying_rain['rainfall_mm']}mm recorded on {qualifying_rain['recorded_at'][:10]} "
                    f"(Source: {qualifying_rain['data_source']}). Reinspection recommended for this rain-exposed {loc['category'].replace('_', ' ')}."
                )
                supporting = [
                    {
                        "record_type": "rainfall",
                        "record_id": qualifying_rain["id"],
                        "date": qualifying_rain["recorded_at"],
                        "summary": f"{qualifying_rain['rainfall_mm']}mm precipitation in {qualifying_rain['area_description']}"
                    }
                ]
                candidate_rec = {
                    "trigger_type": "rainfall_event",
                    "rule_code": "RULE-RAIN-02",
                    "rule_version": "v1.0",
                    "recommended_date": target_date.isoformat(),
                    "explanation": explanation,
                    "supporting_records": supporting,
                    "evidence_level": "sufficient_history",
                    "priority": 3,
                }

        # RULE 4: Low-Information / Missing History Baseline (RULE-LOWINFO-01)
        if not candidate_rec and len(inspections) <= 1:
            loc_created_date = _parse_date(loc["created_at"]) or today
            normal_days = policy["normal_interval_days"]
            target_date = max(today, loc_created_date + timedelta(days=normal_days))
            explanation = (
                f"Not enough inspection history is available (only {len(inspections)} recorded inspection). "
                f"Follow the standard inspection schedule ({normal_days} days)."
            )
            candidate_rec = {
                "trigger_type": "low_information_baseline",
                "rule_code": "RULE-LOWINFO-01",
                "rule_version": "v1.0",
                "recommended_date": target_date.isoformat(),
                "explanation": explanation,
                "supporting_records": [
                    {
                        "record_type": "policy",
                        "record_id": policy["id"],
                        "date": today.isoformat(),
                        "summary": f"Policy '{policy['name']}' baseline: {normal_days} days"
                    }
                ],
                "evidence_level": "limited_history",
                "priority": 4,
            }

        # RULE 5: Routine Periodic Baseline (RULE-BASE-01)
        if not candidate_rec:
            normal_days = policy["normal_interval_days"]
            base_date = last_insp_date or (_parse_date(loc["created_at"]) or today)
            target_date = base_date + timedelta(days=normal_days)
            # If target date is within 3 days or already passed
            if target_date <= today + timedelta(days=3):
                target_date = max(today, target_date)
                explanation = (
                    f"Routine periodic inspection due according to the {normal_days}-day schedule "
                    f"for category '{loc['category'].replace('_', ' ')}'."
                )
                candidate_rec = {
                    "trigger_type": "baseline_policy",
                    "rule_code": "RULE-BASE-01",
                    "rule_version": "v1.0",
                    "recommended_date": target_date.isoformat(),
                    "explanation": explanation,
                    "supporting_records": [
                        {
                            "record_type": "inspection",
                            "record_id": last_inspection["id"] if last_inspection else "none",
                            "date": last_inspection["inspection_date"] if last_inspection else loc["created_at"],
                            "summary": f"Last inspected: {last_inspection['inspection_date'][:10] if last_inspection else 'Never'}"
                        }
                    ],
                    "evidence_level": "sufficient_history",
                    "priority": 5,
                }

        # If no rule triggered, nothing to recommend
        if not candidate_rec:
            return None

        # Check guardrails: do not exceed max_interval_days
        max_limit = today + timedelta(days=policy["max_interval_days"])
        rec_date = _parse_date(candidate_rec["recommended_date"]) or today
        if rec_date > max_limit:
            rec_date = max_limit
            candidate_rec["recommended_date"] = rec_date.isoformat()
            candidate_rec["explanation"] += f" [Adjusted to comply with {policy['max_interval_days']}-day maximum safety interval]."

        # If an approved visit already exists on or near this date (+/- 3 days), do not duplicate
        if upcoming_visit:
            visit_date = _parse_date(upcoming_visit["scheduled_date"])
            if visit_date and abs((visit_date - rec_date).days) <= 3:
                # Satisfied already by approved visit
                return None

        # Idempotency check with existing proposed recommendation
        if existing_rec:
            if existing_rec["rule_code"] == candidate_rec["rule_code"] and not force_reevaluate:
                # Already proposed with same rule, return existing without duplication
                return await cls.get_recommendation_by_id(db, existing_rec["id"])
            else:
                # Supersede old recommendation
                await db.execute(
                    text("""
                        UPDATE reinspection_recommendations
                        SET status = 'superseded', updated_at = :now
                        WHERE id = :rec_id
                    """),
                    {"rec_id": existing_rec["id"], "now": _now_iso()}
                )

        # Insert new recommendation
        new_id = f"REC-{loc['id']}-{today.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        now_str = _now_iso()
        await db.execute(
            text("""
                INSERT INTO reinspection_recommendations
                (id, location_id, trigger_type, rule_code, rule_version,
                 recommended_date, explanation, supporting_records_json,
                 policy_id, status, evidence_level, created_at, updated_at)
                VALUES
                (:id, :location_id, :trigger_type, :rule_code, :rule_version,
                 :recommended_date, :explanation, :supporting_records_json,
                 :policy_id, 'proposed', :evidence_level, :created_at, :updated_at)
            """),
            {
                "id": new_id,
                "location_id": loc["id"],
                "trigger_type": candidate_rec["trigger_type"],
                "rule_code": candidate_rec["rule_code"],
                "rule_version": candidate_rec["rule_version"],
                "recommended_date": candidate_rec["recommended_date"],
                "explanation": candidate_rec["explanation"],
                "supporting_records_json": json.dumps(candidate_rec["supporting_records"]),
                "policy_id": policy["id"],
                "evidence_level": candidate_rec["evidence_level"],
                "created_at": now_str,
                "updated_at": now_str,
            }
        )
        await db.commit()

        return await cls.get_recommendation_by_id(db, new_id)

    @classmethod
    async def get_recommendation_by_id(cls, db: AsyncSession, rec_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a recommendation with complete metadata and decision info."""
        query = text("""
            SELECT r.id, r.location_id, r.trigger_type, r.rule_code, r.rule_version,
                   r.recommended_date, r.explanation, r.supporting_records_json,
                   r.policy_id, r.status, r.evidence_level, r.created_at, r.updated_at,
                   l.location_code, l.name AS location_name, l.category,
                   p.id AS property_id, p.name AS property_name, p.ward_id,
                   pol.name AS policy_name,
                   d.decision, d.approved_date, d.decided_by, d.decision_notes
            FROM reinspection_recommendations r
            JOIN permanent_hazard_locations l ON r.location_id = l.id
            JOIN properties p ON l.property_id = p.id
            LEFT JOIN inspection_policies pol ON r.policy_id = pol.id
            LEFT JOIN recommendation_decisions d ON d.recommendation_id = r.id
            WHERE r.id = :rec_id
        """)
        res = await db.execute(query, {"rec_id": rec_id})
        row = res.mappings().first()
        if not row:
            return None

        data = dict(row)
        try:
            data["supporting_records"] = json.loads(data["supporting_records_json"] or "[]")
        except Exception:
            data["supporting_records"] = []
        return data

    @classmethod
    async def evaluate_all_eligible_locations(
        cls,
        db: AsyncSession,
        ward_id: Optional[str] = None,
        property_id: Optional[str] = None,
        force_reevaluate: bool = False
    ) -> Dict[str, Any]:
        """
        Evaluate all active locations (optionally filtered by ward or property).
        Returns count and list of new recommendations generated.
        """
        conditions = ["l.status = 'active'"]
        params: Dict[str, Any] = {}
        if property_id:
            conditions.append("l.property_id = :prop_id")
            params["prop_id"] = property_id
        if ward_id:
            conditions.append("p.ward_id = :ward_id")
            params["ward_id"] = ward_id

        where_clause = " AND ".join(conditions)
        query = text(f"""
            SELECT l.id
            FROM permanent_hazard_locations l
            JOIN properties p ON l.property_id = p.id
            WHERE {where_clause}
        """)
        res = await db.execute(query, params)
        loc_ids = [r[0] for r in res.fetchall()]

        new_recs = []
        for loc_id in loc_ids:
            rec = await cls.evaluate_location(db, loc_id, force_reevaluate=force_reevaluate)
            if rec and rec.get("status") == "proposed":
                new_recs.append(rec)

        return {
            "evaluated_locations_count": len(loc_ids),
            "recommendations_generated": len(new_recs),
            "new_recommendations": new_recs
        }

    @classmethod
    async def apply_manager_decision(
        cls,
        db: AsyncSession,
        recommendation_id: str,
        decision: str,
        approved_date: Optional[str],
        decision_notes: Optional[str],
        reviewer_name: str
    ) -> Dict[str, Any]:
        """
        Record a manager's decision on a recommendation.
        If approved or modified, automatically creates a scheduled visit.
        """
        rec = await cls.get_recommendation_by_id(db, recommendation_id)
        if not rec:
            raise ValueError(f"Recommendation {recommendation_id} not found.")

        now_str = _now_iso()
        orig_date = rec["recommended_date"]
        final_date = approved_date if (decision in ("approved", "modified") and approved_date) else orig_date

        if decision == "modified" and not approved_date:
            raise ValueError("An approved_date is required when modifying a recommendation.")
        if decision in ("modified", "rejected") and (not decision_notes or not decision_notes.strip()):
            raise ValueError("An explanation is required when modifying or rejecting a recommendation.")

        # Update recommendation status
        await db.execute(
            text("""
                UPDATE reinspection_recommendations
                SET status = :status, updated_at = :now
                WHERE id = :id
            """),
            {"status": decision, "now": now_str, "id": recommendation_id}
        )

        # Record decision audit
        dec_id = f"DEC-{uuid.uuid4().hex[:8].upper()}"
        await db.execute(
            text("""
                INSERT INTO recommendation_decisions
                (id, recommendation_id, decision, original_recommended_date,
                 approved_date, decision_notes, decided_by, decided_at)
                VALUES
                (:id, :rec_id, :decision, :orig_date, :final_date, :notes, :by, :at)
            """),
            {
                "id": dec_id,
                "rec_id": recommendation_id,
                "decision": decision,
                "orig_date": orig_date,
                "final_date": final_date if decision != "rejected" else None,
                "notes": decision_notes,
                "by": reviewer_name,
                "at": now_str,
            }
        )

        scheduled_visit = None
        if decision in ("approved", "modified"):
            sched_id = f"SCHED-{rec['location_id']}-{final_date.replace('-', '')}-{uuid.uuid4().hex[:4].upper()}"
            await db.execute(
                text("""
                    INSERT INTO scheduled_inspections
                    (id, location_id, recommendation_id, scheduled_date, visit_type,
                     status, created_by, notes, created_at, updated_at)
                    VALUES
                    (:id, :loc_id, :rec_id, :s_date, 'recommended',
                     'approved', :created_by, :notes, :now, :now)
                """),
                {
                    "id": sched_id,
                    "loc_id": rec["location_id"],
                    "rec_id": recommendation_id,
                    "s_date": final_date,
                    "created_by": reviewer_name,
                    "notes": decision_notes or rec["explanation"],
                    "now": now_str,
                }
            )

        await db.commit()
        return await cls.get_recommendation_by_id(db, recommendation_id)

    @classmethod
    async def complete_scheduled_inspection(
        cls,
        db: AsyncSession,
        scheduled_id: str,
        inspection_id: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Link an actual completed inspection to a scheduled inspection visit.
        """
        now_str = _now_iso()
        await db.execute(
            text("""
                UPDATE scheduled_inspections
                SET status = 'completed',
                    completed_inspection_id = :insp_id,
                    completed_at = :now,
                    notes = CASE WHEN :notes IS NOT NULL THEN :notes ELSE notes END,
                    updated_at = :now
                WHERE id = :id
            """),
            {
                "id": scheduled_id,
                "insp_id": inspection_id,
                "notes": notes,
                "now": now_str
            }
        )
        await db.commit()

        res = await db.execute(
            text("SELECT * FROM scheduled_inspections WHERE id = :id"),
            {"id": scheduled_id}
        )
        return dict(res.mappings().first())
