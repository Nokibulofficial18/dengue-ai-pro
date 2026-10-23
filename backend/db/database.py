import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from demo_data import WARDS


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./dengueai.db",
)
# Railway gives postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


WARD_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS wards (
    ward_id TEXT PRIMARY KEY,
    ward_name TEXT,
    lat REAL,
    lon REAL,
    drainage_coefficient REAL,
    population_density REAL
)
"""

SWAPI_SCORES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS swapi_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ward_id TEXT,
    score REAL,
    rainfall_3day REAL,
    humidity REAL,
    sunlight_ratio REAL,
    temp_range REAL,
    drainage_inv REAL,
    risk_level TEXT,
    computed_at TEXT
)
"""

PGC_DETECTIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS pgc_detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ward_id TEXT,
    latitude REAL,
    longitude REAL,
    severity TEXT,
    source TEXT,
    verified INTEGER,
    detected_at TEXT
)
"""

CITIZEN_REPORTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS citizen_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ward_id TEXT,
    photo_path TEXT,
    yolo_confidence REAL,
    verified INTEGER,
    points_awarded INTEGER DEFAULT 0,
    submitted_at TEXT
)
"""

DISPATCH_ORDERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS dispatch_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ward_id TEXT,
    ward_name TEXT,
    swapi_score REAL,
    officer_count INTEGER,
    larvicide_litres REAL,
    target_sector TEXT,
    llm_reasoning TEXT,
    rag_citation TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT
)
"""

PROPERTIES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    property_type TEXT NOT NULL,
    ward_id TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    responsible_org TEXT,
    manager_name TEXT,
    manager_contact TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (ward_id) REFERENCES wards (ward_id)
)
"""

PERMANENT_HAZARD_LOCATIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS permanent_hazard_locations (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    location_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    floor_zone TEXT,
    written_directions TEXT,
    latitude REAL,
    longitude REAL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (property_id) REFERENCES properties (id),
    UNIQUE (property_id, location_code)
)
"""

LOCATION_INSPECTIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS location_inspections (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    inspector_name TEXT NOT NULL,
    inspector_role TEXT,
    inspection_date TEXT NOT NULL,
    result TEXT NOT NULL,
    notes TEXT,
    evidence_notes TEXT,
    evidence_photo_path TEXT,
    problem_identified TEXT,
    weather_conditions TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id)
)
"""

LOCATION_ISSUES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS location_issues (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    inspection_id TEXT,
    issue_type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    resolved_at TEXT,
    resolution_notes TEXT,
    resolved_by TEXT,
    is_recurrence INTEGER DEFAULT 0,
    previous_issue_id TEXT,
    recurrence_confirmed_by TEXT,
    recurrence_confirmed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (inspection_id) REFERENCES location_inspections (id),
    FOREIGN KEY (previous_issue_id) REFERENCES location_issues (id)
)
"""

LOCATION_ACTIVITIES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS location_activities (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    issue_id TEXT,
    activity_type TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    performed_at TEXT NOT NULL,
    notes TEXT,
    evidence_photo_path TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (issue_id) REFERENCES location_issues (id)
)
"""

CITIZEN_REPORT_LOCATION_LINKS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS citizen_report_location_links (
    id TEXT PRIMARY KEY,
    report_id INTEGER NOT NULL,
    location_id TEXT NOT NULL,
    linked_by TEXT NOT NULL,
    linked_at TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES citizen_reports (id),
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id)
)
"""

# ============================================================================
# SMART REINSPECTION SCHEDULING TABLES (IMPROVEMENT 02)
# ============================================================================
INSPECTION_POLICIES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS inspection_policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope_type TEXT NOT NULL DEFAULT 'global',
    scope_id TEXT,
    location_category TEXT NOT NULL DEFAULT 'all',
    normal_interval_days INTEGER NOT NULL DEFAULT 14,
    recurrence_followup_days INTEGER NOT NULL DEFAULT 5,
    resolution_followup_days INTEGER NOT NULL DEFAULT 7,
    rainfall_threshold_mm REAL NOT NULL DEFAULT 25.0,
    max_interval_days INTEGER NOT NULL DEFAULT 30,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
"""

RAINFALL_OBSERVATIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS rainfall_observations (
    id TEXT PRIMARY KEY,
    rainfall_mm REAL NOT NULL,
    recorded_at TEXT NOT NULL,
    ward_id TEXT,
    area_description TEXT NOT NULL,
    data_source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'verified',
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (ward_id) REFERENCES wards (ward_id)
)
"""

REINSPECTION_RECOMMENDATIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS reinspection_recommendations (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    rule_code TEXT NOT NULL,
    rule_version TEXT NOT NULL DEFAULT 'v1.0',
    recommended_date TEXT NOT NULL,
    explanation TEXT NOT NULL,
    supporting_records_json TEXT,
    policy_id TEXT,
    status TEXT NOT NULL DEFAULT 'proposed',
    evidence_level TEXT NOT NULL DEFAULT 'sufficient_history',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (policy_id) REFERENCES inspection_policies (id)
)
"""

RECOMMENDATION_DECISIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS recommendation_decisions (
    id TEXT PRIMARY KEY,
    recommendation_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    original_recommended_date TEXT NOT NULL,
    approved_date TEXT,
    decision_notes TEXT,
    decided_by TEXT NOT NULL,
    decided_at TEXT NOT NULL,
    FOREIGN KEY (recommendation_id) REFERENCES reinspection_recommendations (id)
)
"""

SCHEDULED_INSPECTIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS scheduled_inspections (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    recommendation_id TEXT,
    scheduled_date TEXT NOT NULL,
    visit_type TEXT NOT NULL DEFAULT 'recommended',
    status TEXT NOT NULL DEFAULT 'approved',
    assigned_inspector TEXT,
    created_by TEXT NOT NULL,
    completed_inspection_id TEXT,
    completed_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (recommendation_id) REFERENCES reinspection_recommendations (id),
    FOREIGN KEY (completed_inspection_id) REFERENCES location_inspections (id)
)
"""
# ============================================================================
# SERVICE AND RESOLUTION VERIFICATION TABLES (IMPROVEMENT 03)
# ============================================================================
SERVICE_WORK_ORDERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS service_work_orders (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    issue_id TEXT,
    recommendation_id TEXT,
    scheduled_inspection_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    required_action TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_worker_id TEXT,
    assigned_worker_name TEXT NOT NULL,
    assigned_contractor TEXT,
    responsible_supervisor TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'assigned',
    resolution_verification_status TEXT NOT NULL DEFAULT 'awaiting_followup',
    action_performed TEXT,
    action_summary TEXT,
    materials_used TEXT,
    labor_hours REAL DEFAULT 0.0,
    actual_cost REAL DEFAULT 0.0,
    currency TEXT DEFAULT 'BDT',
    repair_classification TEXT DEFAULT 'temporary_mitigation',
    started_at TEXT,
    completed_at TEXT,
    verified_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (property_id) REFERENCES properties (id),
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (issue_id) REFERENCES location_issues (id),
    FOREIGN KEY (recommendation_id) REFERENCES reinspection_recommendations (id),
    FOREIGN KEY (scheduled_inspection_id) REFERENCES scheduled_inspections (id)
)
"""

WORK_ORDER_STATUS_HISTORY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS work_order_status_history (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (work_order_id) REFERENCES service_work_orders (id)
)
"""

SERVICE_EVIDENCE_SUBMISSIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS service_evidence_submissions (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    submission_version INTEGER NOT NULL DEFAULT 1,
    submitted_by TEXT NOT NULL,
    action_type TEXT NOT NULL,
    work_description TEXT NOT NULL,
    materials_used TEXT,
    unresolved_notes TEXT,
    access_restricted INTEGER NOT NULL DEFAULT 0,
    submitted_at TEXT NOT NULL,
    supervisor_decision TEXT NOT NULL DEFAULT 'pending',
    decision_notes TEXT,
    decided_by TEXT,
    decided_at TEXT,
    FOREIGN KEY (work_order_id) REFERENCES service_work_orders (id)
)
"""

SERVICE_EVIDENCE_FILES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS service_evidence_files (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    work_order_id TEXT NOT NULL,
    evidence_category TEXT NOT NULL,
    file_path TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    file_sha256 TEXT NOT NULL,
    is_duplicate_flag INTEGER NOT NULL DEFAULT 0,
    duplicate_reference_file_id TEXT,
    client_captured_at TEXT,
    server_received_at TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (submission_id) REFERENCES service_evidence_submissions (id),
    FOREIGN KEY (work_order_id) REFERENCES service_work_orders (id)
)
"""

RESOLUTION_VERIFICATION_RECORDS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS resolution_verification_records (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    issue_id TEXT,
    location_id TEXT NOT NULL,
    followup_inspection_id TEXT,
    followup_scheduled_id TEXT,
    verified_outcome TEXT NOT NULL,
    verified_by TEXT NOT NULL,
    verified_at TEXT NOT NULL,
    verification_notes TEXT NOT NULL,
    issue_status_after TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (work_order_id) REFERENCES service_work_orders (id),
    FOREIGN KEY (issue_id) REFERENCES location_issues (id),
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (followup_inspection_id) REFERENCES location_inspections (id),
    FOREIGN KEY (followup_scheduled_id) REFERENCES scheduled_inspections (id)
)
"""

# ============================================================================
# PERMANENT REPAIR AND COST-SAVINGS RECOMMENDATIONS TABLES (IMPROVEMENT 04)
# ============================================================================
MAINTENANCE_COST_ENTRIES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS maintenance_cost_entries (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    work_order_id TEXT,
    cost_category TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BDT',
    expense_date TEXT NOT NULL,
    description TEXT,
    invoice_ref TEXT,
    entered_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'recorded',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (property_id) REFERENCES properties (id),
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (work_order_id) REFERENCES service_work_orders (id)
)
"""

REPAIR_ASSESSMENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS repair_assessments (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    issue_id TEXT,
    assessor_name TEXT NOT NULL,
    assessor_role TEXT NOT NULL,
    assessment_date TEXT NOT NULL,
    problem_description TEXT NOT NULL,
    suspected_root_cause TEXT NOT NULL,
    observations TEXT,
    recommended_action TEXT NOT NULL,
    feasibility TEXT NOT NULL DEFAULT 'repair_feasible',
    safety_considerations TEXT,
    additional_investigations TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (property_id) REFERENCES properties (id),
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (issue_id) REFERENCES location_issues (id)
)
"""

REPAIR_PROPOSALS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS repair_proposals (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    assessment_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    responsible_assessor TEXT NOT NULL,
    proposed_method TEXT NOT NULL,
    expected_service_life_years REAL DEFAULT 5.0,
    expected_maintenance_after_per_month REAL DEFAULT 0.0,
    safety_considerations TEXT,
    operational_interruption_hours REAL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'draft',
    approved_quotation_id TEXT,
    implemented_work_order_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (property_id) REFERENCES properties (id),
    FOREIGN KEY (location_id) REFERENCES permanent_hazard_locations (id),
    FOREIGN KEY (assessment_id) REFERENCES repair_assessments (id)
)
"""

SUPPLIER_QUOTATIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS supplier_quotations (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    quoted_amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BDT',
    scope_of_work TEXT NOT NULL,
    included_materials TEXT,
    excluded_costs TEXT,
    lead_time_days INTEGER DEFAULT 7,
    valid_until TEXT NOT NULL,
    warranty_months INTEGER DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (proposal_id) REFERENCES repair_proposals (id)
)
"""

REPAIR_FINANCIAL_SCENARIOS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS repair_financial_scenarios (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL,
    quotation_id TEXT NOT NULL,
    evaluation_period_months INTEGER NOT NULL DEFAULT 12,
    baseline_monthly_cost REAL NOT NULL,
    repair_investment REAL NOT NULL,
    optimistic_monthly_savings REAL NOT NULL,
    optimistic_payback_months REAL,
    expected_monthly_savings REAL NOT NULL,
    expected_payback_months REAL,
    cautious_monthly_savings REAL NOT NULL,
    cautious_payback_months REAL,
    scenario_assumptions TEXT NOT NULL,
    is_approved_baseline INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (proposal_id) REFERENCES repair_proposals (id),
    FOREIGN KEY (quotation_id) REFERENCES supplier_quotations (id)
)
"""

REPAIR_APPROVAL_DECISIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS repair_approval_decisions (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL,
    quotation_id TEXT NOT NULL,
    scenario_id TEXT,
    reviewer_name TEXT NOT NULL,
    reviewer_role TEXT NOT NULL,
    decision TEXT NOT NULL,
    decision_notes TEXT NOT NULL,
    approved_budget REAL NOT NULL,
    decided_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (proposal_id) REFERENCES repair_proposals (id),
    FOREIGN KEY (quotation_id) REFERENCES supplier_quotations (id)
)
"""

# ==============================================================================
# Improvement 05: Coordinated Prevention Across Properties
# ==============================================================================

ORGANIZATIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    org_type TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    authorized_representative TEXT NOT NULL,
    representative_role TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
"""

COORDINATION_GROUPS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS coordination_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_type TEXT NOT NULL,
    managing_org_id TEXT NOT NULL,
    description TEXT,
    geographic_scope TEXT,
    boundary_geojson TEXT,
    coordinator_name TEXT NOT NULL,
    coordinator_contact TEXT,
    participation_rules TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (managing_org_id) REFERENCES organizations (id)
)
"""

GROUP_MEMBERSHIPS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS group_memberships (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'participating_member',
    status TEXT NOT NULL DEFAULT 'active',
    joined_at TEXT NOT NULL,
    withdrawn_at TEXT,
    withdrawal_reason TEXT,
    authorized_by TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(group_id, organization_id),
    FOREIGN KEY (group_id) REFERENCES coordination_groups (id),
    FOREIGN KEY (organization_id) REFERENCES organizations (id)
)
"""

GROUP_INVITATIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS group_invitations (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    invited_org_id TEXT NOT NULL,
    inviting_org_id TEXT NOT NULL,
    invited_by_name TEXT NOT NULL,
    invitation_token TEXT NOT NULL UNIQUE,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    invited_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    decided_at TEXT,
    decision_by_name TEXT,
    decision_notes TEXT,
    FOREIGN KEY (group_id) REFERENCES coordination_groups (id),
    FOREIGN KEY (invited_org_id) REFERENCES organizations (id),
    FOREIGN KEY (inviting_org_id) REFERENCES organizations (id)
)
"""

SHARED_AREAS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS shared_areas (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    area_type TEXT NOT NULL,
    description TEXT,
    latitude REAL,
    longitude REAL,
    boundary_geojson TEXT,
    responsible_org_id TEXT,
    responsible_manager TEXT,
    linked_location_id TEXT,
    visibility_classification TEXT NOT NULL DEFAULT 'consortium_shared',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES coordination_groups (id),
    FOREIGN KEY (responsible_org_id) REFERENCES organizations (id),
    FOREIGN KEY (linked_location_id) REFERENCES permanent_hazard_locations (id)
)
"""

RESPONSIBILITY_HANDOFFS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS responsibility_handoffs (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    shared_area_id TEXT,
    work_order_id TEXT,
    issue_id TEXT,
    originating_org_id TEXT NOT NULL,
    proposed_receiving_org_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    boundary_evidence_summary TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    requested_by_name TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    reviewed_by_name TEXT,
    reviewed_at TEXT,
    review_decision_notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES coordination_groups (id),
    FOREIGN KEY (shared_area_id) REFERENCES shared_areas (id),
    FOREIGN KEY (originating_org_id) REFERENCES organizations (id),
    FOREIGN KEY (proposed_receiving_org_id) REFERENCES organizations (id)
)
"""

DATA_SHARING_PERMISSIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS data_sharing_permissions (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    source_org_id TEXT NOT NULL,
    receiving_org_id TEXT,
    information_category TEXT NOT NULL,
    permitted_access_level TEXT NOT NULL,
    sharing_purpose TEXT NOT NULL,
    is_revoked INTEGER NOT NULL DEFAULT 0,
    granted_by_name TEXT NOT NULL,
    granted_at TEXT NOT NULL,
    expires_at TEXT,
    revoked_by_name TEXT,
    revoked_at TEXT,
    revocation_reason TEXT,
    FOREIGN KEY (group_id) REFERENCES coordination_groups (id),
    FOREIGN KEY (source_org_id) REFERENCES organizations (id)
)
"""

COORDINATION_MEETINGS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS coordination_meetings (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    meeting_title TEXT NOT NULL,
    meeting_date TEXT NOT NULL,
    chairperson_name TEXT NOT NULL,
    chairperson_org_id TEXT NOT NULL,
    attendees_json TEXT NOT NULL,
    discussion_summary TEXT NOT NULL,
    next_meeting_date TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES coordination_groups (id),
    FOREIGN KEY (chairperson_org_id) REFERENCES organizations (id)
)
"""

COORDINATION_ACTION_ITEMS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS coordination_action_items (
    id TEXT PRIMARY KEY,
    meeting_id TEXT,
    group_id TEXT NOT NULL,
    action_title TEXT NOT NULL,
    description TEXT,
    assigned_org_id TEXT NOT NULL,
    assigned_lead_name TEXT,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    linked_shared_area_id TEXT,
    linked_work_order_id TEXT,
    completion_notes TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES coordination_groups (id),
    FOREIGN KEY (meeting_id) REFERENCES coordination_meetings (id),
    FOREIGN KEY (assigned_org_id) REFERENCES organizations (id),
    FOREIGN KEY (linked_shared_area_id) REFERENCES shared_areas (id)
)
"""

COORDINATION_AUDIT_LOGS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS coordination_audit_logs (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    actor_name TEXT NOT NULL,
    actor_org_id TEXT,
    action_type TEXT NOT NULL,
    target_entity_type TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    details_json TEXT,
    timestamp TEXT NOT NULL
)
"""

INDEXES_SQL = [
    "CREATE INDEX IF NOT EXISTS idx_properties_ward_id ON properties (ward_id)",
    "CREATE INDEX IF NOT EXISTS idx_properties_status ON properties (status)",
    "CREATE INDEX IF NOT EXISTS idx_hazard_locations_prop ON permanent_hazard_locations (property_id)",
    "CREATE INDEX IF NOT EXISTS idx_hazard_locations_code ON permanent_hazard_locations (location_code)",
    "CREATE INDEX IF NOT EXISTS idx_hazard_locations_status ON permanent_hazard_locations (status)",
    "CREATE INDEX IF NOT EXISTS idx_inspections_loc ON location_inspections (location_id)",
    "CREATE INDEX IF NOT EXISTS idx_inspections_date ON location_inspections (inspection_date)",
    "CREATE INDEX IF NOT EXISTS idx_issues_loc ON location_issues (location_id)",
    "CREATE INDEX IF NOT EXISTS idx_issues_status ON location_issues (status)",
    "CREATE INDEX IF NOT EXISTS idx_issues_recurrence ON location_issues (is_recurrence)",
    "CREATE INDEX IF NOT EXISTS idx_activities_loc ON location_activities (location_id)",
    "CREATE INDEX IF NOT EXISTS idx_cr_links_report ON citizen_report_location_links (report_id)",
    "CREATE INDEX IF NOT EXISTS idx_cr_links_location ON citizen_report_location_links (location_id)",
    "CREATE INDEX IF NOT EXISTS idx_cr_links_status ON citizen_report_location_links (status)",
    # Improvement 02 Scheduling Indexes
    "CREATE INDEX IF NOT EXISTS idx_policies_scope ON inspection_policies (scope_type, scope_id)",
    "CREATE INDEX IF NOT EXISTS idx_policies_cat ON inspection_policies (location_category)",
    "CREATE INDEX IF NOT EXISTS idx_rainfall_ward ON rainfall_observations (ward_id, recorded_at)",
    "CREATE INDEX IF NOT EXISTS idx_recs_location ON reinspection_recommendations (location_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_recs_status ON reinspection_recommendations (status)",
    "CREATE INDEX IF NOT EXISTS idx_scheduled_loc ON scheduled_inspections (location_id, scheduled_date)",
    "CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_inspections (status, scheduled_date)",
    # Improvement 03 Service Verification Indexes
    "CREATE INDEX IF NOT EXISTS idx_wo_location ON service_work_orders (location_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_wo_issue ON service_work_orders (issue_id)",
    "CREATE INDEX IF NOT EXISTS idx_wo_property ON service_work_orders (property_id)",
    "CREATE INDEX IF NOT EXISTS idx_wo_status ON service_work_orders (status)",
    "CREATE INDEX IF NOT EXISTS idx_wo_worker ON service_work_orders (assigned_worker_name, status)",
    "CREATE INDEX IF NOT EXISTS idx_evidence_wo ON service_evidence_submissions (work_order_id)",
    "CREATE INDEX IF NOT EXISTS idx_evidence_files_hash ON service_evidence_files (file_sha256)",
    "CREATE INDEX IF NOT EXISTS idx_res_verif_wo ON resolution_verification_records (work_order_id)",
    # Improvement 04 Repair and Cost-Savings Indexes
    "CREATE INDEX IF NOT EXISTS idx_costs_loc ON maintenance_cost_entries (location_id, expense_date)",
    "CREATE INDEX IF NOT EXISTS idx_costs_prop ON maintenance_cost_entries (property_id)",
    "CREATE INDEX IF NOT EXISTS idx_costs_wo ON maintenance_cost_entries (work_order_id)",
    "CREATE INDEX IF NOT EXISTS idx_assess_loc ON repair_assessments (location_id)",
    "CREATE INDEX IF NOT EXISTS idx_proposals_loc ON repair_proposals (location_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_proposals_prop ON repair_proposals (property_id)",
    "CREATE INDEX IF NOT EXISTS idx_quotes_prop ON supplier_quotations (proposal_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_scenarios_prop ON repair_financial_scenarios (proposal_id)",
    "CREATE INDEX IF NOT EXISTS idx_approvals_prop ON repair_approval_decisions (proposal_id)",
    # Improvement 05 Coordination Indexes
    "CREATE INDEX IF NOT EXISTS idx_orgs_type ON organizations (org_type)",
    "CREATE INDEX IF NOT EXISTS idx_groups_managing_org ON coordination_groups (managing_org_id)",
    "CREATE INDEX IF NOT EXISTS idx_groups_status ON coordination_groups (status)",
    "CREATE INDEX IF NOT EXISTS idx_memberships_group ON group_memberships (group_id)",
    "CREATE INDEX IF NOT EXISTS idx_memberships_org ON group_memberships (organization_id)",
    "CREATE INDEX IF NOT EXISTS idx_invitations_group ON group_invitations (group_id)",
    "CREATE INDEX IF NOT EXISTS idx_invitations_token ON group_invitations (invitation_token)",
    "CREATE INDEX IF NOT EXISTS idx_shared_areas_group ON shared_areas (group_id)",
    "CREATE INDEX IF NOT EXISTS idx_shared_areas_resp_org ON shared_areas (responsible_org_id)",
    "CREATE INDEX IF NOT EXISTS idx_shared_areas_loc ON shared_areas (linked_location_id)",
    "CREATE INDEX IF NOT EXISTS idx_handoffs_group ON responsibility_handoffs (group_id)",
    "CREATE INDEX IF NOT EXISTS idx_handoffs_status ON responsibility_handoffs (status)",
    "CREATE INDEX IF NOT EXISTS idx_permissions_group ON data_sharing_permissions (group_id)",
    "CREATE INDEX IF NOT EXISTS idx_permissions_source ON data_sharing_permissions (source_org_id)",
    "CREATE INDEX IF NOT EXISTS idx_meetings_group ON coordination_meetings (group_id)",
    "CREATE INDEX IF NOT EXISTS idx_action_items_group ON coordination_action_items (group_id)",
    "CREATE INDEX IF NOT EXISTS idx_action_items_org ON coordination_action_items (assigned_org_id)",
    "CREATE INDEX IF NOT EXISTS idx_coordination_audit_group ON coordination_audit_logs (group_id)",
]


async def _add_column_if_not_exists(conn, table_name: str, column_name: str, column_def: str):
    try:
        res = await conn.execute(text(f"PRAGMA table_info({table_name})"))
        columns = [row[1] for row in res.fetchall()]
        if column_name not in columns:
            await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}"))
    except Exception as e:
        # If table doesn't exist yet or column already added, continue safely
        pass


async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text(WARD_TABLE_SQL))
        await conn.execute(text(SWAPI_SCORES_TABLE_SQL))
        await conn.execute(text(PGC_DETECTIONS_TABLE_SQL))
        await conn.execute(text(CITIZEN_REPORTS_TABLE_SQL))
        await conn.execute(text(DISPATCH_ORDERS_TABLE_SQL))
        # Permanent Hazard Location Records Tables (Improvement 01)
        await conn.execute(text(PROPERTIES_TABLE_SQL))
        await conn.execute(text(PERMANENT_HAZARD_LOCATIONS_TABLE_SQL))
        await conn.execute(text(LOCATION_INSPECTIONS_TABLE_SQL))
        await conn.execute(text(LOCATION_ISSUES_TABLE_SQL))
        await conn.execute(text(LOCATION_ACTIVITIES_TABLE_SQL))
        await conn.execute(text(CITIZEN_REPORT_LOCATION_LINKS_TABLE_SQL))
        # Smart Reinspection Scheduling Tables (Improvement 02)
        await conn.execute(text(INSPECTION_POLICIES_TABLE_SQL))
        await conn.execute(text(RAINFALL_OBSERVATIONS_TABLE_SQL))
        await conn.execute(text(REINSPECTION_RECOMMENDATIONS_TABLE_SQL))
        await conn.execute(text(RECOMMENDATION_DECISIONS_TABLE_SQL))
        await conn.execute(text(SCHEDULED_INSPECTIONS_TABLE_SQL))
        # Service and Resolution Verification Tables (Improvement 03)
        await conn.execute(text(SERVICE_WORK_ORDERS_TABLE_SQL))
        await conn.execute(text(WORK_ORDER_STATUS_HISTORY_TABLE_SQL))
        await conn.execute(text(SERVICE_EVIDENCE_SUBMISSIONS_TABLE_SQL))
        await conn.execute(text(SERVICE_EVIDENCE_FILES_TABLE_SQL))
        await conn.execute(text(RESOLUTION_VERIFICATION_RECORDS_TABLE_SQL))
        # Permanent Repair and Cost-Savings Tables (Improvement 04)
        await conn.execute(text(MAINTENANCE_COST_ENTRIES_TABLE_SQL))
        await conn.execute(text(REPAIR_ASSESSMENTS_TABLE_SQL))
        await conn.execute(text(REPAIR_PROPOSALS_TABLE_SQL))
        await conn.execute(text(SUPPLIER_QUOTATIONS_TABLE_SQL))
        await conn.execute(text(REPAIR_FINANCIAL_SCENARIOS_TABLE_SQL))
        await conn.execute(text(REPAIR_APPROVAL_DECISIONS_TABLE_SQL))
        # Coordinated Prevention Across Properties Tables (Improvement 05)
        await conn.execute(text(ORGANIZATIONS_TABLE_SQL))
        await conn.execute(text(COORDINATION_GROUPS_TABLE_SQL))
        await conn.execute(text(GROUP_MEMBERSHIPS_TABLE_SQL))
        await conn.execute(text(GROUP_INVITATIONS_TABLE_SQL))
        await conn.execute(text(SHARED_AREAS_TABLE_SQL))
        await conn.execute(text(RESPONSIBILITY_HANDOFFS_TABLE_SQL))
        await conn.execute(text(DATA_SHARING_PERMISSIONS_TABLE_SQL))
        await conn.execute(text(COORDINATION_MEETINGS_TABLE_SQL))
        await conn.execute(text(COORDINATION_ACTION_ITEMS_TABLE_SQL))
        await conn.execute(text(COORDINATION_AUDIT_LOGS_TABLE_SQL))

        # Safe non-destructive column additions
        await _add_column_if_not_exists(conn, "properties", "organization_id", "TEXT REFERENCES organizations(id)")
        await _add_column_if_not_exists(conn, "service_work_orders", "coordination_group_id", "TEXT REFERENCES coordination_groups(id)")
        await _add_column_if_not_exists(conn, "service_work_orders", "shared_area_id", "TEXT REFERENCES shared_areas(id)")
        await _add_column_if_not_exists(conn, "scheduled_inspections", "coordination_group_id", "TEXT")
        await _add_column_if_not_exists(conn, "scheduled_inspections", "shared_area_id", "TEXT")

        for idx_sql in INDEXES_SQL:
            await conn.execute(text(idx_sql))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def seed_wards():
    async with AsyncSessionLocal() as session:
        insert_sql = text(
            """
            INSERT OR IGNORE INTO wards
            (ward_id, ward_name, lat, lon, drainage_coefficient, population_density)
            VALUES (:ward_id, :ward_name, :lat, :lon, :drainage_coefficient, :population_density)
            """
        )
        await session.execute(insert_sql, WARDS)
        await session.commit()


async def seed_sites():
    from db.seed_sites import seed_sites_if_empty

    async with AsyncSessionLocal() as session:
        await seed_sites_if_empty(session)


async def seed_scheduling():
    from db.seed_scheduling import seed_scheduling_if_empty

    async with AsyncSessionLocal() as session:
        await seed_scheduling_if_empty(session)


async def seed_services():
    from db.seed_services import seed_services_if_empty

    async with AsyncSessionLocal() as session:
        await seed_services_if_empty(session)


async def seed_repairs():
    from db.seed_repairs import seed_repairs_if_empty

    async with AsyncSessionLocal() as session:
        await seed_repairs_if_empty(session)


async def seed_coordination():
    from db.seed_coordination import seed_coordination_if_empty

    async with AsyncSessionLocal() as session:
        await seed_coordination_if_empty(session)




