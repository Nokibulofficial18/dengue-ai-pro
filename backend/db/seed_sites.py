from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

SEED_PROPERTIES = [
    {
        "id": "PROP-MIR-01",
        "name": "Mirpur Garments Industrial Complex",
        "property_type": "industrial_facility",
        "ward_id": "DHK-001",
        "address": "Plot 12-14, Sector 7, Mirpur Industrial Area, Dhaka",
        "latitude": 23.8223,
        "longitude": 90.3654,
        "responsible_org": "Bengal Textiles Ltd.",
        "manager_name": "Engr. Tariqul Islam",
        "manager_contact": "+880 1711-234567",
        "status": "active",
    },
    {
        "id": "PROP-TEJ-01",
        "name": "Tejgaon Commercial Tower",
        "property_type": "office_building",
        "ward_id": "DHK-005",
        "address": "142-144 Tejgaon Industrial Area, Dhaka",
        "latitude": 23.7639,
        "longitude": 90.3987,
        "responsible_org": "Delta Holdings Group",
        "manager_name": "Nasir Uddin Ahmed",
        "manager_contact": "+880 1819-345678",
        "status": "active",
    },
    {
        "id": "PROP-MOH-01",
        "name": "Mohakhali Health Science Center",
        "property_type": "hospital",
        "ward_id": "DHK-004",
        "address": "TB Gate Road, Mohakhali, Dhaka-1212",
        "latitude": 23.7785,
        "longitude": 90.4072,
        "responsible_org": "National Health Consortium",
        "manager_name": "Dr. Farhana Yasmin",
        "manager_contact": "+880 1912-456789",
        "status": "active",
    },
    {
        "id": "PROP-LAL-01",
        "name": "Lalbagh Heritage Residential Enclave",
        "property_type": "residential_complex",
        "ward_id": "DHK-002",
        "address": "28/A Lalbagh Road, Old Dhaka",
        "latitude": 23.7198,
        "longitude": 90.3882,
        "responsible_org": "Lalbagh Resident Welfare Assoc.",
        "manager_name": "Mohammad Salim",
        "manager_contact": "+880 1515-567890",
        "status": "active",
    },
]

SEED_LOCATIONS = [
    {
        "id": "LOC-MIR-01",
        "property_id": "PROP-MIR-01",
        "location_code": "B-NORTH-DRAIN-07",
        "name": "Building B North Roof Drain 07",
        "category": "roof_drain",
        "floor_zone": "Building B - Roof Level North",
        "written_directions": "Take stairwell 2 door to roof, walk 10m north along perimeter gutter.",
        "latitude": 23.8225,
        "longitude": 90.3656,
        "description": "Primary perimeter roof runoff channel with chronic leaf and sediment blockage tendency.",
        "status": "active",
    },
    {
        "id": "LOC-MIR-02",
        "property_id": "PROP-MIR-01",
        "location_code": "BASEMENT-SUMP-01",
        "name": "Basement East Sump Well",
        "category": "basement_drain",
        "floor_zone": "Basement Level B1 East",
        "written_directions": "Enter freight basement ramp, locate pump station behind maintenance cage 4.",
        "latitude": 23.8221,
        "longitude": 90.3652,
        "description": "Sub-grade drainage pit where electrical pump tripped causing standing water.",
        "status": "active",
    },
    {
        "id": "LOC-TEJ-01",
        "property_id": "PROP-TEJ-01",
        "location_code": "ROOF-HVAC-TRAY-02",
        "name": "Chiller Plant Condensate Collection Tray",
        "category": "water_tank",
        "floor_zone": "Roof Floor Mechanical Zone",
        "written_directions": "Rooftop mechanical pent, adjacent to cooling tower cell 2.",
        "latitude": 23.7641,
        "longitude": 90.3989,
        "description": "Open overflow condensate pan under chiller exhaust with slow outflow slope.",
        "status": "active",
    },
    {
        "id": "LOC-MOH-01",
        "property_id": "PROP-MOH-01",
        "location_code": "COURT-BASIN-03",
        "name": "South Courtyard Infiltration Basin",
        "category": "construction_pit",
        "floor_zone": "Ground Level Courtyard South",
        "written_directions": "Behind OPD Annex wing, through southern garden pathway.",
        "latitude": 23.7783,
        "longitude": 90.4070,
        "description": "Perimeter stormwater retention culvert undergoing foundation works.",
        "status": "active",
    },
]


async def seed_sites_if_empty(session: AsyncSession):
    """Seed sample properties, hazard locations, and initial timeline if table is empty."""
    count_row = (await session.execute(text("SELECT COUNT(*) FROM properties"))).scalar_one()
    if count_row > 0:
        return

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # 1. Insert properties
    for prop in SEED_PROPERTIES:
        await session.execute(
            text(
                """
                INSERT INTO properties
                (id, name, property_type, ward_id, address, latitude, longitude,
                 responsible_org, manager_name, manager_contact, status, created_at, updated_at)
                VALUES
                (:id, :name, :property_type, :ward_id, :address, :latitude, :longitude,
                 :responsible_org, :manager_name, :manager_contact, :status, :created_at, :updated_at)
                """
            ),
            {
                **prop,
                "created_at": (now - timedelta(days=60)).isoformat(),
                "updated_at": now_iso,
            },
        )

    # 2. Insert locations
    for loc in SEED_LOCATIONS:
        await session.execute(
            text(
                """
                INSERT INTO permanent_hazard_locations
                (id, property_id, location_code, name, category, floor_zone,
                 written_directions, latitude, longitude, description, status, created_at, updated_at)
                VALUES
                (:id, :property_id, :location_code, :name, :category, :floor_zone,
                 :written_directions, :latitude, :longitude, :description, :status, :created_at, :updated_at)
                """
            ),
            {
                **loc,
                "created_at": (now - timedelta(days=55)).isoformat(),
                "updated_at": now_iso,
            },
        )

    # 3. Seed an initial real-world recurring issue timeline on LOC-MIR-01
    # Historical Issue 1 (resolved 30 days ago)
    t_minus_45 = (now - timedelta(days=45)).isoformat()
    t_minus_44 = (now - timedelta(days=44)).isoformat()
    t_minus_30 = (now - timedelta(days=30)).isoformat()
    t_minus_10 = (now - timedelta(days=10)).isoformat()
    t_minus_9 = (now - timedelta(days=9)).isoformat()

    # Initial Inspection 1
    await session.execute(
        text(
            """
            INSERT INTO location_inspections
            (id, location_id, inspector_name, inspector_role, inspection_date, result,
             notes, evidence_notes, problem_identified, weather_conditions, created_at)
            VALUES
            ('INSP-SEED-01', 'LOC-MIR-01', 'Inspector M. Rahman', 'DNCC Health Inspector',
             :insp_date, 'problem_found', 'Discovered 4cm deep standing rainwater pooling at roof drain grate.',
             'Sediment and discarded plastic packaging obstructing runoff.', 'Standing water and organic debris',
             'Overcast, post-monsoon shower', :created_at)
            """
        ),
        {"insp_date": t_minus_45, "created_at": t_minus_45},
    )

    # Historical Issue 1 (Resolved)
    await session.execute(
        text(
            """
            INSERT INTO location_issues
            (id, location_id, inspection_id, issue_type, description, severity,
             observed_at, status, resolved_at, resolution_notes, resolved_by,
             is_recurrence, previous_issue_id, created_at, updated_at)
            VALUES
            ('ISSUE-SEED-01', 'LOC-MIR-01', 'INSP-SEED-01', 'standing_water',
             'Severe pooling around north roof drain channel', 'high',
             :observed_at, 'resolved', :resolved_at,
             'Drain cleared of sediment; perimeter flushed with biological larvicide.',
             'Supervisor K. Hossain', 0, NULL, :observed_at, :resolved_at)
            """
        ),
        {"observed_at": t_minus_45, "resolved_at": t_minus_30},
    )

    # Activity: Cleaning & Larvicide
    await session.execute(
        text(
            """
            INSERT INTO location_activities
            (id, location_id, issue_id, activity_type, performed_by, performed_at, notes, created_at)
            VALUES
            ('ACT-SEED-01', 'LOC-MIR-01', 'ISSUE-SEED-01', 'cleaning',
             'Maintenance Team Lead A. Karim', :performed_at,
             'Cleared 15kg wet silt and plastic debris from drain mouth.', :created_at)
            """
        ),
        {"performed_at": t_minus_44, "created_at": t_minus_44},
    )

    # Activity: Inspection Result Clear
    await session.execute(
        text(
            """
            INSERT INTO location_inspections
            (id, location_id, inspector_name, inspector_role, inspection_date, result,
             notes, evidence_notes, problem_identified, weather_conditions, created_at)
            VALUES
            ('INSP-SEED-02', 'LOC-MIR-01', 'Inspector M. Rahman', 'DNCC Health Inspector',
             :insp_date, 'clear',
             'Follow-up visit. Water drained completely. Note: Site cleared on this visit; ongoing structural slope assessment recommended.',
             'No pooling observed at time of inspection.', NULL, 'Sunny, dry 31C', :created_at)
            """
        ),
        {"insp_date": t_minus_30, "created_at": t_minus_30},
    )

    # Later Recurring Issue (Discovered 10 days ago, confirmed recurring from ISSUE-SEED-01)
    await session.execute(
        text(
            """
            INSERT INTO location_inspections
            (id, location_id, inspector_name, inspector_role, inspection_date, result,
             notes, evidence_notes, problem_identified, weather_conditions, created_at)
            VALUES
            ('INSP-SEED-03', 'LOC-MIR-01', 'Senior Inspector Z. Haque', 'DNCC Lead Officer',
             :insp_date, 'problem_found',
             'Water returned to same roof drain after 48h rains. Insufficient gradient causes water to stagnate.',
             'Active mosquito larvae observed in pool.', 'Standing water and larvae present', 'Rainy, 28C', :created_at)
            """
        ),
        {"insp_date": t_minus_10, "created_at": t_minus_10},
    )

    await session.execute(
        text(
            """
            INSERT INTO location_issues
            (id, location_id, inspection_id, issue_type, description, severity,
             observed_at, status, resolved_at, resolution_notes, resolved_by,
             is_recurrence, previous_issue_id, recurrence_confirmed_by, recurrence_confirmed_at,
             created_at, updated_at)
            VALUES
            ('ISSUE-SEED-02', 'LOC-MIR-01', 'INSP-SEED-03', 'standing_water',
             'Water returned to same location despite earlier clearing. Underlying slope defect suspected.',
             'high', :observed_at, 'open', NULL, NULL, NULL,
             1, 'ISSUE-SEED-01', 'Senior Inspector Z. Haque', :rec_conf_at,
             :observed_at, :now_iso)
            """
        ),
        {
            "observed_at": t_minus_10,
            "rec_conf_at": t_minus_9,
            "now_iso": now_iso,
        },
    )

    await session.commit()
