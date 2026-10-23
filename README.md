# DengueAI Pro — AI-Augmented Dengue Risk Intelligence System

DengueAI Pro is an enterprise, multi-tenant dengue risk intelligence and vector management system designed for municipal authorities, industrial parks, commercial campuses, and community stakeholders.

The platform integrates ward-level environmental risk modeling (SWAPI), permanent facility hazard registries, rule-based reinspection scheduling, field service verification, long-term structural repair economics, and inter-property cross-boundary coordination.

---

## System Architecture & Module Overview

```
                        ┌──────────────────────────────────────────────┐
                        │              DengueAI Pro Frontend           │
                        │       (React 18 + Vite + Leaflet + Axios)    │
                        └──────────────────────┬───────────────────────┘
                                               │ HTTP / REST
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │             FastAPI Backend Service          │
                        │       (Python 3.11+ / Async SQLAlchemy)       │
                        └──────┬──────┬───────┬───────┬───────┬────────┘
                               │      │       │       │       │
       ┌───────────────────────┘      │       │       │       └────────────────────────┐
       ▼                              ▼       ▼       ▼                                ▼
┌──────────────┐             ┌────────────────┐ ┌────────────────┐            ┌────────────────┐
│   Core /     │             │ Improvement 01 │ │ Improvement 02 │            │ Improvement 05 │
│ SWAPI Risk & │             │  Site & Hazard │ │     Smart      │            │  Consortium &  │
│ Dispatch     │             │    Registry    │ │   Scheduling   │            │  Coordination  │
└──────┬───────┘             └───────┬────────┘ └───────┬────────┘            └───────┬────────┘
       │                             │                  │                             │
       │                             ▼                  ▼                             │
       │                     ┌───────────────────────────────────┐                    │
       │                     │          Improvement 03           │                    │
       │                     │    Service Work Order Lifecycle   │                    │
       │                     │    & Evidence Verification Queue  │                    │
       │                     └─────────────────┬─────────────────┘                    │
       │                                       │                                      │
       │                                       ▼                                      │
       │                     ┌───────────────────────────────────┐                    │
       └────────────────────►│          Improvement 04           │◄───────────────────┘
                             │  Permanent Repair & Cost Savings  │
                             │  (Assessment, Quotes, Payback)    │
                             └─────────────────┬─────────────────┘
                                               │
                                               ▼
                             ┌───────────────────────────────────┐
                             │       SQLite / aiosqlite DB       │
                             │          (dengueai.db)            │
                             └───────────────────────────────────┘
```

### Core Subsystems:
1. **Ward Risk Intelligence (SWAPI Engine):** Calculates non-linear environmental monsoon risk scores [0, 1] across Dhaka wards using rainfall, temperature, humidity, sunlight, and drainage coefficients.
2. **Improvement 01 — Permanent Hazard Location Records:** Registers facilities, permanent outdoor/indoor breeding spots (roof drains, sumps, cooling towers), recurring issue chains, and chronological inspection timelines.
3. **Improvement 02 — Smart Reinspection Scheduling:** Priority inspection policies, recurrence accelerators, verified rainfall triggers, managerial approval, and unified calendar management.
4. **Improvement 03 — Service & Resolution Verification:** Complete work-order dispatch lifecycle, photographic evidence submission with SHA-256 duplicate detection, supervisor reviews, independent follow-up verification, and recurring issue reopenings.
5. **Improvement 04 — Permanent Repair & Cost Savings:** Maintenance expense tracking, recurring-cost opportunity detection, engineering assessments, supplier quotations, 3-scenario payback modeling, and conversion to capital repair work orders.
6. **Improvement 05 — Coordinated Prevention Across Properties:** Multi-tenant tenant accounts, consortium groups, invitation workflows, shared boundary drainage areas, joint inspections/work orders, and server-side default-deny permission isolation.

---

## Prerequisites

- **Python:** 3.11 or higher (Python 3.13 supported)
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **Git**

---

## Environment Setup

### 1. Backend Configuration

Navigate to the `backend/` directory:
```bash
cd backend
```

Create a virtual environment and install dependencies:
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

Configure your `.env` file (copied from `.env.example`):
```env
DEMO_MODE=true
DATABASE_URL=sqlite+aiosqlite:///./dengueai.db
ANTHROPIC_API_KEY=demo
OPENAI_API_KEY=demo
OPENWEATHERMAP_API_KEY=demo
```

*Note: In `DEMO_MODE=true`, the application runs with high-fidelity demonstration datasets representing Dhaka monsoon conditions, deterministic WHO RAG retrieval, and simulated AI responses without requiring paid third-party API keys.*

### 2. Frontend Configuration

Navigate to the `frontend/` directory:
```bash
cd ../frontend
npm install
```

Configure `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

---

## Running the Application Locally

### Start the Backend Server:
```bash
cd backend
.\.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```
- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Database file `backend/dengueai.db` is initialized automatically on startup using non-destructive table creation (`Base.metadata.create_all`).

### Start the Frontend Dev Server:
```bash
cd frontend
npm run dev
```
- Frontend UI: `http://localhost:5173`

---

## Development Authentication & Permissions

During local development and testing, role-based access control (RBAC) and multi-tenant isolation are managed via HTTP request headers:

- **`X-Authority-Key`**: API key for administrative operations (default test key: `demo-authority-key`).
- **`X-User-Role`**: Role used for permission checks:
  - `worker`: Can view assigned tasks, submit labor hours, and upload photographic evidence.
  - `supervisor`: Can review evidence, approve work completion, and request clarification.
  - `property_manager`: Can register properties, approve inspection schedules, and approve repair proposals.
  - `finance_approver`: Can authorize capital expenditure budgets and supplier quotations.
  - `coordinator`: Can manage consortium groups, send invitations, and assign shared areas.
- **`X-Organization-Id`**: Tenant identifier enforcing data isolation boundaries.

---

## Automated Test Suites

The repository contains 7 comprehensive test suites covering unit logic, security isolation, and cross-feature integration:

```bash
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

### Test Suite Summary (41/41 Passing):
- `tests/test_e2e_integration.py`: Complete 14-stage lifecycle from property creation through inspection, recurrence, repair payback, shared consortium, and SQLite persistence.
- `tests/test_original_and_security.py`: Dispatch queue idempotency, citizen photo upload security, SWAPI risk tiers, lexical RAG fallback, and multi-tenant data isolation.
- `tests/test_coordination.py`: Consortium invitations, shared areas, and default-deny permissions.
- `tests/test_repair_planning.py`: Financial calculations, 3-scenario payback modeling, supplier quotes, and approval guards.
- `tests/test_service_verification.py`: Work order state transitions, photo evidence hashing, and supervisor reviews.
- `tests/test_sites_hazard_registry.py`: Property registries, permanent hazard locations, and issue timelines.
- `tests/test_smart_scheduling.py`: Reinspection policies, recurrence-based frequency adjustments, and rainfall triggers.

### Frontend Production Build:
```bash
cd frontend
npm run build
```
Compiles production bundles to `frontend/dist/` without errors or warnings.

---

## Audited Implementation Status & Limitations

See [`IMPLEMENTATION_STATUS.md`](file:///c:/Users/ADMiN/Desktop/dengueai-pro/IMPLEMENTATION_STATUS.md) and [`FINAL_SYSTEM_VERIFICATION_REPORT.md`](file:///c:/Users/ADMiN/Desktop/dengueai-pro/FINAL_SYSTEM_VERIFICATION_REPORT.md) for full technical audit details.

### What Is Genuine & Operational:
- Full CRUD, relational data integrity, and persistent workflows for Improvements 1 through 5.
- Mathematical SWAPI risk weighting across 10 Dhaka wards.
- Dispatch queue generation with idempotent retrieval.
- Multi-tenant data segregation preventing cross-organization leakage.
- Deterministic RAG retriever matching WHO/DGHS clinical guidelines.
- Cryptographic duplicate file detection on field evidence.

### What Is Prototype / Simulated / Unimplemented:
- **Trained LSTM / Neural Outbreak Forecasting:** Not implemented; proposal-only concept. Historical 2023 DGHS figures displayed.
- **YOLOv8 Computer Vision:** Citizen photo uploads are safely validated and stored, but no live neural object detection runs. Reports are honestly recorded as unverified pending field review.
- **Satellite Multispectral Detection:** Sentinel-2 processing pipeline was proposed in hackathon pitch but is not implemented.
- **Weather Feed:** Runs on realistic demo monsoon data by default; live streaming requires an OpenWeatherMap API key.
- **Database Scalability:** Uses SQLite for zero-configuration local runs; high-concurrency production deployments require migration to PostgreSQL.
