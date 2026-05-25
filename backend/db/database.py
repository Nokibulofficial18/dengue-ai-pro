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


async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text(WARD_TABLE_SQL))
        await conn.execute(text(SWAPI_SCORES_TABLE_SQL))
        await conn.execute(text(PGC_DETECTIONS_TABLE_SQL))
        await conn.execute(text(CITIZEN_REPORTS_TABLE_SQL))
        await conn.execute(text(DISPATCH_ORDERS_TABLE_SQL))


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
