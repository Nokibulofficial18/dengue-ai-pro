"""
Router for Improvement 04 — Permanent Repair and Cost-Savings Recommendations.
Exposes REST endpoints for:
- Tracking historical maintenance expenses by location and service visit
- Identifying recurring-cost opportunities with configurable review rules
- Recording qualified engineering technical assessments
- Managing repair proposals and multi-contractor supplier quotations
- Calculating 3 explicit financial comparison scenarios (Optimistic, Expected, Cautious)
- Persisting auditable financial scenario snapshots
- Managerial and financial approval workflows with role-based governance
- Converting approved proposals into executable service work orders
- Post-repair outcome evaluations (monitoring follow-up inspections, recurrences, and actual spending)
- Portfolio-level capital planning and maintenance economics
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from models.repair_schemas import (
    ApprovalDecisionOut,
    ApprovalDecisionRequest,
    FinancialComparisonResponse,
    FinancialScenarioOut,
    HistoricalCostSummary,
    MaintenanceCostCreate,
    MaintenanceCostOut,
    PortfolioRepairEconomicsOut,
    PostRepairOutcomeOut,
    RepairAssessmentCreate,
    RepairAssessmentOut,
    RepairOpportunityOut,
    RepairProposalCreate,
    RepairProposalOut,
    RepairProposalUpdate,
    SaveScenarioRequest,
    SupplierQuotationCreate,
    SupplierQuotationOut,
)
from services.repair_cost_analyzer import RepairCostAnalyzer
from services.repair_opportunity_service import RepairOpportunityService
from utils.auth import AuthorityUser, get_current_authority_user

router = APIRouter(prefix="/repair-planning", tags=["Permanent Repair & Cost Savings"])


class CreateWorkOrderRequest(BaseModel):
    assigned_worker_name: str = Field(..., min_length=2)
    due_date: str = Field(..., description="Target completion date (YYYY-MM-DD)")
    responsible_supervisor: str = Field(..., min_length=2)


# ============================================================================
# 1. RECURRING-COST OPPORTUNITIES & PORTFOLIO DASHBOARD
# ============================================================================
@router.get("/opportunities", response_model=List[RepairOpportunityOut])
async def list_repair_opportunities(
    min_recurrences: int = Query(1, ge=0, description="Minimum confirmed issue recurrences to trigger review"),
    min_spend: float = Query(0.0, ge=0.0, description="Minimum recorded maintenance spend in BDT"),
    property_id: Optional[str] = Query(None, description="Filter by property ID"),
    ward_id: Optional[str] = Query(None, description="Filter by ward ID"),
    category: Optional[str] = Query(None, description="Filter by decision support category"),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Identify permanent hazard locations with recurring maintenance activity,
    cumulative historical costs, and missing data indicators for repair assessment.
    """
    opportunities = await RepairOpportunityService.get_repair_opportunities(
        db=db,
        property_id=property_id,
        ward_id=ward_id,
        min_recurrences=min_recurrences,
        min_spend=min_spend,
    )
    if category and category != "all":
        opportunities = [o for o in opportunities if o["decision_support_category"] == category]
    return opportunities


@router.get("/portfolio", response_model=PortfolioRepairEconomicsOut)
async def get_portfolio_repair_economics(
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    High-level capital planning overview across all managed properties,
    comparing historical recurring spend, approved repair investments, and realized savings.
    """
    return await RepairOpportunityService.get_portfolio_economics(db)


# ============================================================================
# 2. HISTORICAL MAINTENANCE COSTS
# ============================================================================
@router.get("/locations/{location_id}/costs", response_model=HistoricalCostSummary)
async def get_location_cost_history(
    location_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Detailed historical maintenance expense breakdown for a specific permanent hazard location,
    including individual cost line items, visit averages, and missing data alerts.
    """
    try:
        return await RepairOpportunityService.get_location_cost_summary(db, location_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/costs", response_model=MaintenanceCostOut, status_code=status.HTTP_201_CREATED)
async def record_maintenance_cost(
    payload: MaintenanceCostCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Record an individual maintenance or repair expense item (labor, materials, contractor charges).
    Enforces currency isolation and decimal safety.
    """
    try:
        return await RepairOpportunityService.record_cost_entry(
            db=db,
            data=payload.model_dump(),
            entered_by=f"{user.display_name} ({user.role})",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================================================
# 3. QUALIFIED TECHNICAL ASSESSMENTS
# ============================================================================
@router.post("/assessments", response_model=RepairAssessmentOut, status_code=status.HTTP_201_CREATED)
async def record_technical_assessment(
    payload: RepairAssessmentCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Record an in-person physical engineering root-cause assessment by a qualified technical professional.
    Software does not independently invent engineering repairs without professional input.
    """
    # Permission check: Field worker cannot submit engineering root-cause assessments
    if user.role == "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Field maintenance workers cannot submit engineering root-cause assessments. Qualified Assessor, Supervisor, or Manager role required.",
        )
    try:
        return await RepairOpportunityService.record_technical_assessment(
            db=db,
            data=payload.model_dump(),
            user_name=user.display_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/assessments", response_model=List[RepairAssessmentOut])
async def list_technical_assessments(
    location_id: Optional[str] = Query(None),
    property_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List historical engineering root-cause assessments."""
    return await RepairOpportunityService.get_assessments(db, location_id, property_id)


@router.get("/assessments/{assessment_id}", response_model=RepairAssessmentOut)
async def get_technical_assessment(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Get single technical assessment detail."""
    assessment = await RepairOpportunityService.get_assessment_by_id(db, assessment_id)
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Assessment '{assessment_id}' not found.")
    return assessment


# ============================================================================
# 4. REPAIR PROPOSALS
# ============================================================================
@router.post("/proposals", response_model=RepairProposalOut, status_code=status.HTTP_201_CREATED)
async def create_repair_proposal(
    payload: RepairProposalCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Register a proposed permanent repair solution linked to a hazard location and technical assessment.
    """
    if user.role == "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maintenance workers cannot register capital repair proposals. Assessor or Manager role required.",
        )
    try:
        return await RepairOpportunityService.create_repair_proposal(
            db=db,
            data=payload.model_dump(),
            user_name=user.display_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/proposals", response_model=List[RepairProposalOut])
async def list_repair_proposals(
    property_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    location_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List repair proposals with attached quotations and review statuses."""
    return await RepairOpportunityService.list_repair_proposals(
        db=db,
        property_id=property_id,
        status=status_filter,
        location_id=location_id,
    )


@router.get("/proposals/{proposal_id}", response_model=RepairProposalOut)
async def get_repair_proposal_detail(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Get full proposal profile including supplier quotations and assessment metadata."""
    prop = await RepairOpportunityService.get_repair_proposal(db, proposal_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Proposal '{proposal_id}' not found.")
    return prop


@router.patch("/proposals/{proposal_id}", response_model=RepairProposalOut)
async def update_repair_proposal(
    proposal_id: str,
    payload: RepairProposalUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Update proposal details, expected life, or review status."""
    updated = await RepairOpportunityService.update_repair_proposal(
        db=db,
        proposal_id=proposal_id,
        updates=payload.model_dump(exclude_unset=True),
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Proposal '{proposal_id}' not found.")
    return updated


# ============================================================================
# 5. SUPPLIER QUOTATIONS
# ============================================================================
@router.post("/proposals/{proposal_id}/quotations", response_model=SupplierQuotationOut, status_code=status.HTTP_201_CREATED)
async def add_supplier_quotation(
    proposal_id: str,
    payload: SupplierQuotationCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """Attach a verified contractor quotation to a repair proposal for price comparison."""
    if user.role == "worker":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contractor field workers cannot attach capital repair quotations. Manager or Approver required.",
        )
    try:
        return await RepairOpportunityService.add_supplier_quotation(
            db=db,
            proposal_id=proposal_id,
            data=payload.model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/proposals/{proposal_id}/quotations", response_model=List[SupplierQuotationOut])
async def list_supplier_quotations(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List all competing supplier quotations for a repair proposal."""
    return await RepairOpportunityService.list_supplier_quotations(db, proposal_id)


# ============================================================================
# 6. FINANCIAL COMPARISON ENGINE (SCENARIOS & AUDITABLE SNAPSHOTS)
# ============================================================================
@router.post("/proposals/{proposal_id}/calculate", response_model=FinancialComparisonResponse)
async def calculate_repair_financials(
    proposal_id: str,
    quotation_id: str = Query(..., description="Selected supplier quotation ID"),
    evaluation_period_months: int = Query(12, ge=3, le=60, description="Comparison window in months"),
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    On-the-fly, read-only multi-scenario financial calculation:
    Models Scenario A (Optimistic), Scenario B (Expected), Scenario C (Cautious).
    Includes zero-division guardrails, payback period, and explicit uncertainty disclaimers.
    Does NOT modify the database.
    """
    try:
        return await RepairCostAnalyzer.calculate_financial_scenarios(
            db=db,
            proposal_id=proposal_id,
            quotation_id=quotation_id,
            evaluation_period_months=evaluation_period_months,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/proposals/{proposal_id}/save-scenario", response_model=FinancialScenarioOut, status_code=status.HTTP_201_CREATED)
async def save_financial_scenario_snapshot(
    proposal_id: str,
    payload: SaveScenarioRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Persist an auditable snapshot of the financial comparison and assumptions
    so past managerial decisions can be verified later.
    """
    try:
        return await RepairCostAnalyzer.save_financial_scenario(
            db=db,
            proposal_id=proposal_id,
            quotation_id=payload.quotation_id,
            evaluation_period_months=payload.evaluation_period_months,
            assumptions_notes=payload.assumptions_notes,
            is_approved_baseline=payload.is_approved_baseline,
            created_by=f"{user.display_name} ({user.role})",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/proposals/{proposal_id}/scenarios", response_model=List[FinancialScenarioOut])
async def list_proposal_saved_scenarios(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List saved financial comparison scenario snapshots for a repair proposal."""
    return await RepairCostAnalyzer.list_saved_scenarios(db, proposal_id)


# ============================================================================
# 7. MANAGERIAL APPROVAL WORKFLOW
# ============================================================================
@router.get("/proposals/{proposal_id}/approvals", response_model=List[ApprovalDecisionOut])
async def list_proposal_approval_decisions(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """List historical managerial approval and rejection decisions for an auditable review."""
    return await RepairCostAnalyzer.list_approval_decisions(db, proposal_id)
@router.post("/proposals/{proposal_id}/approve", response_model=ApprovalDecisionOut, status_code=status.HTTP_201_CREATED)
async def record_approval_decision(
    proposal_id: str,
    payload: ApprovalDecisionRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Record an internal managerial decision (Approved, Rejected, More Info Required)
    with mandatory rationale, role attribution, and approved budget ceiling.
    Strict governance: Maintenance workers and technical assessors CANNOT authorize capital expenditure.
    """
    disallowed_roles = ["worker", "maintenance_assessor"]
    if user.role in disallowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user.role}' is not authorized to approve capital budgets or reject proposals. Property Manager or Finance Approver authorization required.",
        )

    try:
        return await RepairCostAnalyzer.record_approval_decision(
            db=db,
            proposal_id=proposal_id,
            quotation_id=payload.quotation_id,
            decision=payload.decision,
            decision_notes=payload.decision_notes,
            reviewer_name=user.display_name,
            reviewer_role=user.role,
            approved_budget=payload.approved_budget,
            scenario_id=payload.scenario_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================================================
# 8. WORK ORDER INTEGRATION (CONNECT TO IMPROVEMENT 3)
# ============================================================================
@router.post("/proposals/{proposal_id}/create-work-order")
async def create_repair_implementation_work_order(
    proposal_id: str,
    payload: CreateWorkOrderRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Launch an executable service work order inside Improvement 03 infrastructure
    for an approved repair proposal, keeping the complete verification lifecycle intact.
    """
    if user.role in ["worker", "maintenance_assessor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Worker/Assessor cannot dispatch repair work orders. Manager or Supervisor role required.",
        )

    try:
        return await RepairCostAnalyzer.create_implementation_work_order(
            db=db,
            proposal_id=proposal_id,
            assigned_worker_name=payload.assigned_worker_name,
            due_date=payload.due_date,
            responsible_supervisor=payload.responsible_supervisor,
            user_name=user.display_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================================================
# 9. POST-REPAIR OUTCOME EVALUATION
# ============================================================================
@router.get("/proposals/{proposal_id}/outcomes", response_model=PostRepairOutcomeOut)
async def get_post_repair_outcomes(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),
    user: AuthorityUser = Depends(get_current_authority_user),
):
    """
    Evaluate actual operational and financial results after repair implementation:
    - Number of follow-up reinspections conducted (Improvement 02)
    - Number of recurrences observed (Improvement 01)
    - Actual repair cost vs approved quote variance
    - Post-repair maintenance expenditures vs baseline forecast
    - Rigorous missing data notices when observation window is insufficient
    """
    try:
        return await RepairCostAnalyzer.track_post_repair_outcomes(db, proposal_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
