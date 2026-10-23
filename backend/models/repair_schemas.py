"""
Pydantic schemas for Improvement 04 — Permanent Repair and Cost-Savings Recommendations.
Defines data validation models for historical maintenance expenses, technical repair assessments,
repair proposals, supplier quotations, multi-scenario financial comparisons (Optimistic,
Expected, Cautious), managerial approval decisions, and post-repair outcome evaluations.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# HISTORICAL MAINTENANCE COSTS
# ============================================================================
class MaintenanceCostCreate(BaseModel):
    property_id: str
    location_id: str
    work_order_id: Optional[str] = None
    cost_category: str = Field(
        ...,
        description="'labor', 'contractor_fee', 'materials', 'equipment_rental', 'transportation', 'disposal', 'other'"
    )
    amount: float = Field(..., gt=0.0, description="Expense amount in specified currency")
    currency: str = Field("BDT", description="ISO currency code (default: BDT)")
    expense_date: str = Field(..., description="Date expense was incurred (YYYY-MM-DD)")
    description: Optional[str] = None
    invoice_ref: Optional[str] = None
    status: str = Field("recorded", description="'recorded', 'verified', 'estimated'")


class MaintenanceCostOut(BaseModel):
    id: str
    property_id: str
    property_name: Optional[str] = None
    location_id: str
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    work_order_id: Optional[str] = None
    cost_category: str
    amount: float
    currency: str
    expense_date: str
    description: Optional[str] = None
    invoice_ref: Optional[str] = None
    entered_by: str
    status: str
    created_at: str
    updated_at: str


class HistoricalCostSummary(BaseModel):
    location_id: str
    location_code: str
    location_name: str
    property_id: str
    property_name: str
    total_recorded_cost: float
    verified_cost: float
    estimated_cost: float
    currency: str
    total_service_visits: int
    cost_bearing_visits: int
    average_cost_per_visit: float
    first_expense_date: Optional[str] = None
    latest_expense_date: Optional[str] = None
    cost_by_category: Dict[str, float] = Field(default_factory=dict)
    entries: List[MaintenanceCostOut] = Field(default_factory=list)


# ============================================================================
# REPAIR OPPORTUNITIES
# ============================================================================
class RepairOpportunityOut(BaseModel):
    location_id: str
    location_code: str
    location_name: str
    category: str
    property_id: str
    property_name: str
    ward_id: Optional[str] = None
    confirmed_recurrence_count: int
    verified_service_visits: int
    total_maintenance_spend: float
    average_monthly_spend: float
    currency: str
    latest_issue_date: Optional[str] = None
    latest_issue_status: Optional[str] = None
    has_technical_assessment: bool
    latest_assessment_id: Optional[str] = None
    latest_assessment_feasibility: Optional[str] = None
    has_repair_proposal: bool
    latest_proposal_id: Optional[str] = None
    latest_proposal_status: Optional[str] = None
    has_supplier_quotation: bool
    lowest_quote_amount: Optional[float] = None
    decision_support_category: str = Field(
        ...,
        description="'needs_technical_assessment', 'needs_cost_data', 'ready_for_financial_review', 'financially_promising', 'financially_unfavorable', 'insufficient_information'"
    )
    explanation: str
    missing_data_warnings: List[str] = Field(default_factory=list)


# ============================================================================
# QUALIFIED MAINTENANCE ASSESSMENTS
# ============================================================================
class RepairAssessmentCreate(BaseModel):
    property_id: str
    location_id: str
    issue_id: Optional[str] = None
    assessor_name: str = Field(..., min_length=2)
    assessor_role: str = Field(..., min_length=2, description="Professional title, e.g. Senior Drainage Engineer")
    assessment_date: str = Field(..., description="Date of physical inspection (YYYY-MM-DD)")
    problem_description: str = Field(..., min_length=5)
    suspected_root_cause: str = Field(..., min_length=5)
    observations: Optional[str] = None
    recommended_action: str = Field(..., min_length=5)
    feasibility: str = Field(
        "repair_feasible",
        description="'repair_feasible', 'further_investigation_required', 'repair_not_recommended', 'no_feasible_repair'"
    )
    safety_considerations: Optional[str] = None
    additional_investigations: Optional[str] = None


class RepairAssessmentOut(BaseModel):
    id: str
    property_id: str
    property_name: Optional[str] = None
    location_id: str
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    issue_id: Optional[str] = None
    assessor_name: str
    assessor_role: str
    assessment_date: str
    problem_description: str
    suspected_root_cause: str
    observations: Optional[str] = None
    recommended_action: str
    feasibility: str
    safety_considerations: Optional[str] = None
    additional_investigations: Optional[str] = None
    created_at: str
    updated_at: str


# ============================================================================
# REPAIR PROPOSALS
# ============================================================================
class RepairProposalCreate(BaseModel):
    property_id: str
    location_id: str
    assessment_id: Optional[str] = None
    title: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., min_length=5)
    responsible_assessor: str = Field(..., min_length=2)
    proposed_method: str = Field(..., min_length=5)
    expected_service_life_years: float = Field(5.0, ge=0.5)
    expected_maintenance_after_per_month: float = Field(0.0, ge=0.0)
    safety_considerations: Optional[str] = None
    operational_interruption_hours: float = Field(0.0, ge=0.0)


class RepairProposalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    proposed_method: Optional[str] = None
    expected_service_life_years: Optional[float] = None
    expected_maintenance_after_per_month: Optional[float] = None
    safety_considerations: Optional[str] = None
    operational_interruption_hours: Optional[float] = None
    status: Optional[str] = None


class SupplierQuotationOut(BaseModel):
    id: str
    proposal_id: str
    supplier_name: str
    quoted_amount: float
    currency: str
    scope_of_work: str
    included_materials: Optional[str] = None
    excluded_costs: Optional[str] = None
    lead_time_days: int
    valid_until: str
    warranty_months: int
    status: str
    created_at: str
    updated_at: str


class SupplierQuotationCreate(BaseModel):
    supplier_name: str = Field(..., min_length=2)
    quoted_amount: float = Field(..., gt=0.0)
    currency: str = Field("BDT")
    scope_of_work: str = Field(..., min_length=5)
    included_materials: Optional[str] = None
    excluded_costs: Optional[str] = None
    lead_time_days: int = Field(7, ge=0)
    valid_until: str = Field(..., description="Quotation validity deadline (YYYY-MM-DD)")
    warranty_months: int = Field(12, ge=0)


class RepairProposalOut(BaseModel):
    id: str
    property_id: str
    property_name: Optional[str] = None
    location_id: str
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    assessment_id: Optional[str] = None
    assessment_feasibility: Optional[str] = None
    title: str
    description: str
    responsible_assessor: str
    proposed_method: str
    expected_service_life_years: float
    expected_maintenance_after_per_month: float
    safety_considerations: Optional[str] = None
    operational_interruption_hours: float
    status: str
    approved_quotation_id: Optional[str] = None
    implemented_work_order_id: Optional[str] = None
    created_at: str
    updated_at: str
    quotations: List[SupplierQuotationOut] = Field(default_factory=list)


# ============================================================================
# FINANCIAL COMPARISON & SCENARIOS
# ============================================================================
class ScenarioResult(BaseModel):
    scenario_name: str  # 'Optimistic', 'Expected', 'Cautious'
    description: str
    assumed_cost_reduction_pct: float
    expected_maintenance_after_per_month: float
    monthly_savings: float
    simple_payback_months: Optional[float] = None
    cumulative_cost_without_repair: float
    cumulative_cost_with_repair: float
    net_savings_over_period: float
    roi_pct: float
    is_financially_viable: bool
    assumptions_summary: str


class FinancialComparisonResponse(BaseModel):
    proposal_id: str
    quotation_id: str
    supplier_name: str
    quoted_amount: float
    currency: str
    evaluation_period_months: int
    baseline_observation_months: int
    baseline_total_recorded_cost: float
    baseline_monthly_recurring_cost: float
    optimistic_scenario: ScenarioResult
    expected_scenario: ScenarioResult
    cautious_scenario: ScenarioResult
    caveat_statement: str
    missing_data_warnings: List[str] = Field(default_factory=list)


class SaveScenarioRequest(BaseModel):
    quotation_id: str
    evaluation_period_months: int = Field(12, ge=3, le=60)
    assumptions_notes: Optional[str] = None
    is_approved_baseline: bool = False


class FinancialScenarioOut(BaseModel):
    id: str
    proposal_id: str
    quotation_id: str
    supplier_name: Optional[str] = None
    evaluation_period_months: int
    baseline_monthly_cost: float
    repair_investment: float
    optimistic_monthly_savings: float
    optimistic_payback_months: Optional[float]
    expected_monthly_savings: float
    expected_payback_months: Optional[float]
    cautious_monthly_savings: float
    cautious_payback_months: Optional[float]
    scenario_assumptions: str
    is_approved_baseline: bool
    created_by: str
    created_at: str


# ============================================================================
# APPROVAL WORKFLOW
# ============================================================================
class ApprovalDecisionRequest(BaseModel):
    quotation_id: str
    decision: str = Field(..., description="'approved', 'rejected', 'more_info_required'")
    decision_notes: str = Field(..., min_length=3, description="Mandatory decision explanation and review rationale")
    approved_budget: Optional[float] = Field(None, ge=0.0)
    scenario_id: Optional[str] = None


class ApprovalDecisionOut(BaseModel):
    id: str
    proposal_id: str
    quotation_id: str
    supplier_name: Optional[str] = None
    scenario_id: Optional[str] = None
    reviewer_name: str
    reviewer_role: str
    decision: str
    decision_notes: str
    approved_budget: float
    decided_at: str
    created_at: str


# ============================================================================
# POST-REPAIR OUTCOME TRACKING & PORTFOLIO
# ============================================================================
class PostRepairOutcomeOut(BaseModel):
    proposal_id: str
    proposal_title: str
    location_id: str
    location_code: str
    location_name: str
    property_id: str
    property_name: str
    repair_completed_at: Optional[str] = None
    approved_quote_amount: float
    actual_repair_cost: float
    cost_variance: float
    currency: str
    days_since_completion: int
    post_repair_inspections_count: int
    post_repair_recurrences_count: int
    post_repair_maintenance_spend: float
    predicted_monthly_savings: float
    observed_monthly_spend: float
    realized_savings_to_date: Optional[float] = None
    is_outcome_verified: bool
    status_summary: str


class PortfolioRepairEconomicsOut(BaseModel):
    total_locations_tracked: int
    locations_with_recurring_costs: int
    total_historical_maintenance_spend: float
    currency: str
    total_repair_proposals: int
    proposals_awaiting_assessment: int
    proposals_awaiting_approval: int
    approved_repairs_count: int
    implemented_repairs_count: int
    total_approved_repair_investment: float
    total_forecasted_annual_savings: float
    total_actual_post_repair_spend: float
    property_breakdown: List[Dict[str, Any]] = Field(default_factory=list)
