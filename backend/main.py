from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.database import init_db, seed_wards
from rag.retriever import init_knowledge_base
from sqlalchemy import text
from db.database import AsyncSessionLocal
from routers import citizen, dispatch, heatmap, swapi


port = int(os.getenv("PORT", 8000))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("DengueAI Pro starting up...")
    await init_db()
    await seed_wards()
    await init_knowledge_base()
    print("Database and RAG initialized")
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
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include all routers
app.include_router(swapi.router, prefix="/api", tags=["SWAPI"])
app.include_router(dispatch.router, prefix="/api", tags=["Dispatch"])
app.include_router(citizen.router, prefix="/api", tags=["Citizen"])
app.include_router(heatmap.router, prefix="/api", tags=["Heatmap"])


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
        },
        "message": "DengueAI Pro running — all features available",
    }


@app.post("/api/demo/reset")
async def demo_reset():
    async with AsyncSessionLocal() as session:
        await session.execute(text("DELETE FROM citizen_reports"))
        await session.execute(text("DELETE FROM pgc_detections"))
        await session.execute(text("DELETE FROM dispatch_orders"))
        await session.execute(text("DELETE FROM swapi_scores"))
        await session.commit()
    await seed_wards()
    await init_knowledge_base()
    return {"status": "reset complete"}
