"""
Pydantic schemas for Improvement 02 — Smart Reinspection Scheduling.
Defines validation and serialization models for inspection policies,
rainfall observations, explainable recommendations, manager decisions,
and scheduled visits.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# INSPECTION POLICIES
# ============================================================================
class InspectionPolicyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    scope_type: str = Field("global", description="'global', 'property', or 'category'")
    scope_id: Optional[str] = Field(None, description="Property ID or null if global")
    location_category: str = Field("all", description="'all' or specific category e.g. 'roof_drain'")
    normal_interval_days: int = Field(14, ge=1, le=180, description="Standard inspection interval")
    recurrence_followup_days: int = Field(5, ge=1, le=60, description="Followup days for recurring issues")
    resolution_followup_days: int = Field(7, ge=1, le=60, description="Post-resolution check days")
    rainfall_threshold_mm: float = Field(25.0, ge=0.0, le=500.0, description="Rainfall trigger threshold in mm")
    max_interval_days: int = Field(30, ge=3, le=365, description="Mandatory maximum safety interval")
    is_active: bool = True


class InspectionPolicyCreate(InspectionPolicyBase):
    pass


class InspectionPolicyUpdate(BaseModel):
    name: Optional[str] = None
    normal_interval_days: Optional[int] = None
    recurrence_followup_days: Optional[int] = None
    resolution_followup_days: Optional[int] = None
    rainfall_threshold_mm: Optional[float] = None
    max_interval_days: Optional[int] = None
    is_active: Optional[bool] = None


class InspectionPolicyOut(InspectionPolicyBase):
    id: str
    created_at: str
    updated_at: str


# ============================================================================
# RAINFALL OBSERVATIONS
# ============================================================================
class RainfallObservationCreate(BaseModel):
    rainfall_mm: float = Field(..., ge=0.0, le=1000.0)
    recorded_at: str = Field(..., description="ISO 8601 timestamp of measurement")
    ward_id: Optional[str] = Field(None, description="Target Ward ID if localized")
    area_description: str = Field(..., min_length=3, description="Geographic area covered")
    data_source: str = Field(..., min_length=3, description="Source (BMD Station, Local Gauge, etc.)")
    status: str = Field("verified", description="'verified', 'manual_observation', 'provisional'")
    notes: Optional[str] = None


class RainfallObservationOut(BaseModel):
    id: str
    rainfall_mm: float
    recorded_at: str
    ward_id: Optional[str]
    area_description: str
    data_source: str
    status: str
    notes: Optional[str]
    created_at: str


# ============================================================================
# REINSPECTION RECOMMENDATIONS & EXPLANATIONS
# ============================================================================
class SupportingRecord(BaseModel):
    record_type: str = Field(..., description="'issue', 'inspection', 'rainfall', 'activity', 'policy'")
    record_id: str
    date: str
    summary: str


class ReinspectionRecommendationOut(BaseModel):
    id: str
    location_id: str
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    ward_id: Optional[str] = None
    category: Optional[str] = None
    trigger_type: str = Field(..., description="'recurring_hazard', 'post_resolution_followup', 'rainfall_event', 'low_information_baseline', 'baseline_policy'")
    rule_code: str
    rule_version: str
    recommended_date: str
    explanation: str
    supporting_records: List[SupportingRecord] = []
    policy_id: Optional[str] = None
    policy_name: Optional[str] = None
    status: str = Field("proposed", description="'proposed', 'approved', 'modified', 'rejected', 'superseded', 'cancelled'")
    evidence_level: str = Field("sufficient_history", description="'sufficient_history' or 'limited_history'")
    created_at: str
    updated_at: str
    # Decision details if reviewed
    decision: Optional[str] = None
    approved_date: Optional[str] = None
    decided_by: Optional[str] = None
    decision_notes: Optional[str] = None


class RecommendationDecisionRequest(BaseModel):
    decision: str = Field(..., description="'approved', 'modified', or 'rejected'")
    approved_date: Optional[str] = Field(None, description="Required if decision is 'approved' or 'modified' (YYYY-MM-DD)")
    decision_notes: Optional[str] = Field(None, description="Explanation or reasoning for decision (mandatory if modified or rejected)")


# ============================================================================
# SCHEDULED INSPECTIONS
# ============================================================================
class ScheduledInspectionCreate(BaseModel):
    location_id: str
    scheduled_date: str = Field(..., description="Target visit date (YYYY-MM-DD)")
    visit_type: str = Field("recommended", description="'required', 'recommended', 'followup'")
    assigned_inspector: Optional[str] = None
    notes: Optional[str] = None


class ScheduledInspectionCompleteRequest(BaseModel):
    completed_inspection_id: str
    notes: Optional[str] = None


class ScheduledInspectionOut(BaseModel):
    id: str
    location_id: str
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    ward_id: Optional[str] = None
    recommendation_id: Optional[str] = None
    scheduled_date: str
    visit_type: str
    status: str = Field("approved", description="'approved', 'completed', 'cancelled'")
    is_overdue: bool = False
    assigned_inspector: Optional[str] = None
    created_by: str
    completed_inspection_id: Optional[str] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str


# ============================================================================
# EVALUATION & CALENDAR
# ============================================================================
class EvaluationRequest(BaseModel):
    location_id: Optional[str] = None
    property_id: Optional[str] = None
    ward_id: Optional[str] = None
    force_reevaluate: bool = False


class EvaluationResult(BaseModel):
    evaluated_locations_count: int
    recommendations_generated: int
    recommendations_superseded: int
    recommendations_unchanged: int
    new_recommendations: List[ReinspectionRecommendationOut] = []


class SchedulingCalendarItem(BaseModel):
    id: str
    item_type: str = Field(..., description="'proposed_recommendation', 'approved_visit', 'completed_visit'")
    date: str
    location_id: str
    location_code: str
    location_name: str
    property_id: str
    property_name: str
    ward_id: str
    category: str
    status: str = Field(..., description="'proposed', 'approved', 'completed', 'overdue'")
    title: str
    subtitle: str
    explanation: Optional[str] = None
    assigned_inspector: Optional[str] = None


# ============================================================================
# OPERATIONAL STATISTICS
# ============================================================================
class SchedulingStatsOut(BaseModel):
    total_locations: int
    active_policies: int
    total_recommendations: int
    proposed_recommendations: int
    approved_recommendations: int
    rejected_recommendations: int
    acceptance_rate_pct: float
    total_scheduled_visits: int
    upcoming_approved_visits: int
    overdue_visits: int
    completed_visits: int
    issues_found_on_reinspection: int
    recurring_issues_caught: int
    recent_rainfall_events: int


# ============================================================================
# LOCATION SCHEDULE SUMMARY (FOR LOCATION DETAIL MODAL)
# ============================================================================
class LocationSchedulingStatusOut(BaseModel):
    location_id: str
    effective_policy_name: str
    normal_interval_days: int
    last_inspection_date: Optional[str] = None
    last_inspection_result: Optional[str] = None
    next_required_date: Optional[str] = None
    has_active_recommendation: bool = False
    active_recommendation: Optional[ReinspectionRecommendationOut] = None
    next_approved_visit: Optional[ScheduledInspectionOut] = None
    status_summary: str
