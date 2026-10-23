from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# -------------------------------------------------------------
# Property Schemas
# -------------------------------------------------------------
class PropertyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Property or building name")
    property_type: str = Field(
        ...,
        description="factory, office_building, university_campus, residential_complex, hospital, industrial_facility, other",
    )
    ward_id: str = Field(..., description="Associated ward ID (e.g. DHK-001)")
    address: str = Field(..., min_length=5, description="Physical address or detailed location description")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    responsible_org: Optional[str] = None
    manager_name: Optional[str] = None
    manager_contact: Optional[str] = None


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    property_type: Optional[str] = None
    ward_id: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    responsible_org: Optional[str] = None
    manager_name: Optional[str] = None
    manager_contact: Optional[str] = None
    status: Optional[Literal["active", "archived"]] = None


class PropertyOut(BaseModel):
    id: str
    name: str
    property_type: str
    ward_id: str
    ward_name: Optional[str] = None
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    responsible_org: Optional[str] = None
    manager_name: Optional[str] = None
    manager_contact: Optional[str] = None
    status: str
    created_at: str
    updated_at: str
    location_count: int = 0
    active_issues_count: int = 0


# -------------------------------------------------------------
# Permanent Hazard Location Schemas
# -------------------------------------------------------------
class LocationCreate(BaseModel):
    location_code: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="Human-readable code (e.g. B-NORTH-DRAIN-07, ROOF-01)",
    )
    name: str = Field(..., min_length=2, max_length=150, description="Descriptive name")
    category: str = Field(
        ...,
        description="roof_drain, water_tank, construction_pit, basement_drain, outdoor_container, fountain, gutter, other",
    )
    floor_zone: Optional[str] = None
    written_directions: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None


class LocationUpdate(BaseModel):
    location_code: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    floor_zone: Optional[str] = None
    written_directions: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    status: Optional[Literal["active", "archived"]] = None


class LocationOut(BaseModel):
    id: str
    property_id: str
    property_name: Optional[str] = None
    ward_id: Optional[str] = None
    ward_name: Optional[str] = None
    location_code: str
    name: str
    category: str
    floor_zone: Optional[str] = None
    written_directions: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    status: str
    created_at: str
    updated_at: str
    open_issues_count: int = 0
    total_inspections_count: int = 0
    confirmed_recurrences_count: int = 0


# -------------------------------------------------------------
# Inspection Schemas
# -------------------------------------------------------------
SAFETY_DISCLAIMER = (
    "Observation valid only for time of visit. A 'clear' result confirms no stagnant water "
    "or vector hazard was visible on this inspection; it does NOT certify the location is permanently dengue-free."
)


class InspectionCreate(BaseModel):
    inspector_name: str = Field(..., min_length=2)
    inspector_role: Optional[str] = Field("Authority Inspector")
    inspection_date: Optional[str] = None
    result: Literal["clear", "problem_found", "unable_to_inspect"]
    notes: Optional[str] = None
    evidence_notes: Optional[str] = None
    problem_identified: Optional[str] = None
    weather_conditions: Optional[str] = None
    # Optional shortcut to register finding directly with this inspection
    create_issue: Optional[bool] = False
    issue_type: Optional[str] = None
    issue_severity: Optional[Literal["low", "medium", "high", "critical"]] = "medium"
    issue_description: Optional[str] = None
    is_recurrence: Optional[bool] = False
    previous_issue_id: Optional[str] = None


class InspectionOut(BaseModel):
    id: str
    location_id: str
    inspector_name: str
    inspector_role: Optional[str] = None
    inspection_date: str
    result: str
    notes: Optional[str] = None
    evidence_notes: Optional[str] = None
    evidence_photo_path: Optional[str] = None
    problem_identified: Optional[str] = None
    weather_conditions: Optional[str] = None
    created_at: str
    safety_disclaimer: str = SAFETY_DISCLAIMER


# -------------------------------------------------------------
# Issue / Finding Schemas
# -------------------------------------------------------------
class IssueCreate(BaseModel):
    inspection_id: Optional[str] = None
    issue_type: str = Field(
        ...,
        description="standing_water, larvae_detected, clogged_drainage, broken_cover, debris_accumulation, other",
    )
    description: str = Field(..., min_length=5)
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    observed_at: Optional[str] = None
    is_recurrence: Optional[bool] = False
    previous_issue_id: Optional[str] = None
    recurrence_confirmed_by: Optional[str] = None


class IssueUpdate(BaseModel):
    description: Optional[str] = None
    severity: Optional[Literal["low", "medium", "high", "critical"]] = None
    status: Optional[Literal["open", "resolved"]] = None
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None


class IssueResolveRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=5, description="Action taken and outcome")
    resolved_by: str = Field(..., min_length=2, description="Name and title of authority confirming resolution")


class ConfirmRecurrenceRequest(BaseModel):
    previous_issue_id: str = Field(..., description="ID of the earlier resolved issue at this location")
    confirmed_by: str = Field(..., min_length=2, description="Name and title of reviewing authority")
    notes: Optional[str] = None


class IssueOut(BaseModel):
    id: str
    location_id: str
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    property_name: Optional[str] = None
    inspection_id: Optional[str] = None
    issue_type: str
    description: str
    severity: str
    observed_at: str
    status: str
    resolved_at: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    is_recurrence: int = 0
    previous_issue_id: Optional[str] = None
    previous_issue_description: Optional[str] = None
    recurrence_confirmed_by: Optional[str] = None
    recurrence_confirmed_at: Optional[str] = None
    created_at: str
    updated_at: str


# -------------------------------------------------------------
# Activity / Maintenance Schemas
# -------------------------------------------------------------
class ActivityCreate(BaseModel):
    issue_id: Optional[str] = None
    activity_type: str = Field(
        ...,
        description="cleaning, larvicide_treatment, drainage_repair, structural_modification, inspection, notes, status_change",
    )
    performed_by: str = Field(..., min_length=2)
    performed_at: Optional[str] = None
    notes: Optional[str] = None


class ActivityOut(BaseModel):
    id: str
    location_id: str
    issue_id: Optional[str] = None
    activity_type: str
    performed_by: str
    performed_at: str
    notes: Optional[str] = None
    evidence_photo_path: Optional[str] = None
    created_at: str


# -------------------------------------------------------------
# Timeline & Recurring Aggregation Schemas
# -------------------------------------------------------------
class TimelineEvent(BaseModel):
    id: str
    timestamp: str
    event_type: str  # inspection, issue_reported, activity, issue_resolved, recurrence_flagged, citizen_report_linked
    title: str
    description: Optional[str] = None
    performed_by: Optional[str] = None
    status: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LocationTimelineOut(BaseModel):
    location: LocationOut
    events: List[TimelineEvent]


class RecurringLocationOut(BaseModel):
    location_id: str
    location_code: str
    location_name: str
    category: str
    property_id: str
    property_name: str
    ward_id: str
    ward_name: str
    repeat_count_90d: int
    total_repeat_count: int
    open_issues_count: int
    latest_issue_date: Optional[str] = None
    latest_issue_description: Optional[str] = None
    summary_statement: str
    recurring_issues: List[IssueOut] = Field(default_factory=list)


# -------------------------------------------------------------
# Citizen Report Association Schemas
# -------------------------------------------------------------
class CitizenReportLinkRequest(BaseModel):
    location_id: str
    linked_by: str = Field(..., min_length=2)
    notes: Optional[str] = None


class CitizenReportWithLocation(BaseModel):
    id: int
    ward_id: str
    ward_name: Optional[str] = None
    photo_path: Optional[str] = None
    yolo_confidence: float
    verified: int
    points_awarded: int
    submitted_at: str
    # Location Link Details (None if unassigned)
    link_id: Optional[str] = None
    location_id: Optional[str] = None
    location_code: Optional[str] = None
    location_name: Optional[str] = None
    property_id: Optional[str] = None
    property_name: Optional[str] = None
    linked_by: Optional[str] = None
    linked_at: Optional[str] = None
    link_notes: Optional[str] = None
    link_status: Optional[str] = None
    # Suggested candidate locations in same ward
    candidate_locations: List[Dict[str, Any]] = Field(default_factory=list)
