from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.database import init_db, seed_wards, seed_sites, seed_scheduling, seed_services, seed_repairs, seed_coordination
from rag.retriever import init_knowledge_base
from sqlalchemy import text
from db.database import AsyncSessionLocal
from routers import citizen, dispatch, heatmap, swapi, sites, scheduling, services, repair_planning, coordination


port = int(os.getenv("PORT", 8000))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("DengueAI Pro starting up...")
    await init_db()
    await seed_wards()
    await seed_sites()
    await seed_scheduling()
    await seed_services()
    await seed_repairs()
    await seed_coordination()
    await init_knowledge_base()
    print("Database, Sites, Scheduling, Services, Repairs, Coordination, and RAG initialized")
    yield
    # Shutdown
    print("DengueAI Pro shutting down")


app = FastAPI(
    title="DengueAI Pro API",
    description="AI-native dengue prevention intelligence system for Bangladesh",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow all origins for demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://dengueaipro.netlify.app/",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request, call_next):
    print(f"{request.method} {request.url.path}")
    response = await call_next(request)
    return response

# Mount uploads directory for photo serving
os.makedirs("uploads", exist_ok=True)
os.makedirs("uploads/service_evidence", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include all routers
app.include_router(swapi.router, prefix="/api", tags=["SWAPI"])
app.include_router(dispatch.router, prefix="/api", tags=["Dispatch"])
app.include_router(citizen.router, prefix="/api", tags=["Citizen"])
app.include_router(heatmap.router, prefix="/api", tags=["Heatmap"])
app.include_router(sites.router, prefix="/api", tags=["Site & Hazard Registry"])
app.include_router(sites.auth_router, prefix="/api", tags=["Authority Security"])
app.include_router(scheduling.router, prefix="/api", tags=["Smart Reinspection Scheduling"])
app.include_router(services.router, prefix="/api", tags=["Service & Resolution Verification"])
app.include_router(repair_planning.router, prefix="/api", tags=["Permanent Repair & Cost Savings"])
app.include_router(coordination.router, prefix="/api", tags=["Coordinated Prevention Across Properties"])


@app.get("/")
async def root():
    return {"message": "DengueAI Pro API", "version": "1.0.0", "docs": "/docs"}


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "mode": "demo" if os.getenv("DEMO_MODE", "true") == "true" else "live",
        "wards_loaded": 10,
        "rag_ready": True,
        "site_hazard_registry": True,
        "smart_reinspection_scheduling": True,
        "service_resolution_verification": True,
        "permanent_repair_recommendations": True,
        "repair_cost_recommendations": True,
        "coordinated_prevention": True,
    }


@app.get("/api/demo/status")
async def demo_status():
    return {
        "mode": "demo",
        "wards_loaded": 10,
        "swapi_computed": True,
        "rag_seeded": True,
        "llm": "Claude API (falls back to mock if no key)",
        "features": {
            "heatmap": True,
            "dispatch_queue": True,
            "llm_chat": True,
            "citizen_reporting": True,
            "rag_retrieval": True,
            "site_hazard_registry": True,
            "permanent_locations": True,
            "smart_reinspection_scheduling": True,
            "service_resolution_verification": True,
            "permanent_repair_recommendations": True,
            "repair_cost_recommendations": True,
            "coordinated_prevention": True,
        },
        "message": "DengueAI Pro running — all features available",
    }


@app.post("/api/demo/reset")
async def demo_reset():
    async with AsyncSessionLocal() as session:
        # Improvement 05 tables
        await session.execute(text("DELETE FROM coordination_audit_logs"))
        await session.execute(text("DELETE FROM coordination_action_items"))
        await session.execute(text("DELETE FROM coordination_meetings"))
        await session.execute(text("DELETE FROM data_sharing_permissions"))
        await session.execute(text("DELETE FROM responsibility_handoffs"))
        await session.execute(text("DELETE FROM shared_areas"))
        await session.execute(text("DELETE FROM group_invitations"))
        await session.execute(text("DELETE FROM group_memberships"))
        await session.execute(text("DELETE FROM coordination_groups"))
        await session.execute(text("DELETE FROM organizations"))
        # Improvement 04 tables
        await session.execute(text("DELETE FROM repair_approval_decisions"))
        await session.execute(text("DELETE FROM repair_financial_scenarios"))
        await session.execute(text("DELETE FROM supplier_quotations"))
        await session.execute(text("DELETE FROM repair_proposals"))
        await session.execute(text("DELETE FROM repair_assessments"))
        await session.execute(text("DELETE FROM maintenance_cost_entries"))
        # Improvement 03 tables
        await session.execute(text("DELETE FROM resolution_verification_records"))
        await session.execute(text("DELETE FROM service_evidence_files"))
        await session.execute(text("DELETE FROM service_evidence_submissions"))
        await session.execute(text("DELETE FROM work_order_status_history"))
        await session.execute(text("DELETE FROM service_work_orders"))
        # Improvement 02 tables
        await session.execute(text("DELETE FROM scheduled_inspections"))
        await session.execute(text("DELETE FROM recommendation_decisions"))
        await session.execute(text("DELETE FROM reinspection_recommendations"))
        await session.execute(text("DELETE FROM rainfall_observations"))
        await session.execute(text("DELETE FROM inspection_policies"))
        # Improvement 01 tables
        await session.execute(text("DELETE FROM citizen_report_location_links"))
        await session.execute(text("DELETE FROM location_activities"))
        await session.execute(text("DELETE FROM location_issues"))
        await session.execute(text("DELETE FROM location_inspections"))
        await session.execute(text("DELETE FROM permanent_hazard_locations"))
        await session.execute(text("DELETE FROM properties"))
        # Base tables
        await session.execute(text("DELETE FROM citizen_reports"))
        await session.execute(text("DELETE FROM pgc_detections"))
        await session.execute(text("DELETE FROM dispatch_orders"))
        await session.execute(text("DELETE FROM swapi_scores"))
        await session.commit()
    await seed_wards()
    await seed_sites()
    await seed_scheduling()
    await seed_services()
    await seed_repairs()
    await seed_coordination()
    await init_knowledge_base()
    return {"status": "reset complete"}




