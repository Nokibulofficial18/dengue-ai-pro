from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from demo_data import WEATHER, WARDS
from models.swapi_model import (
    SWAPIResult,
    WeatherData,
    compute_swapi,
    get_risk_color,
)


router = APIRouter(prefix="/swapi")

# In-memory cache: {ward_id: {result: SWAPIResult, cached_at: datetime}}
_cache = {}
CACHE_TTL_SECONDS = 21600  # 6 hours


class ComputeRequest(BaseModel):
    rainfall_3day_mm: float
    humidity_percent: float
    sunlight_hours: float
    temp_max: float
    temp_min: float
    drainage_coefficient: float
    ward_id: str | None = None
    ward_name: str | None = None


def _cache_is_fresh(cached_at: datetime) -> bool:
    return datetime.utcnow() - cached_at < timedelta(seconds=CACHE_TTL_SECONDS)


def _result_to_dict(result: SWAPIResult, include_color: bool = False):
    payload = {
        "ward_id": result.ward_id,
        "ward_name": result.ward_name,
        "score": result.score,
        "risk_level": result.risk_level,
        "rainfall_contribution": result.rainfall_contribution,
        "humidity_contribution": result.humidity_contribution,
        "sunlight_contribution": result.sunlight_contribution,
        "temp_contribution": result.temp_contribution,
        "drainage_contribution": result.drainage_contribution,
        "computed_at": result.computed_at,
    }
    if include_color:
        payload["color"] = get_risk_color(result.score)
    return payload


def _get_ward(ward_id: str):
    for ward in WARDS:
        if ward["ward_id"] == ward_id:
            return ward
    return None


@router.get("/all")
def list_swapi_alerts():
    results = []
    for ward in WARDS:
        cached = _cache.get(ward["ward_id"])
        if cached and _cache_is_fresh(cached["cached_at"]):
            result = cached["result"]
        else:
            weather = WEATHER.get(ward["ward_id"])
            if not weather:
                continue
            result = compute_swapi(
                ward_id=ward["ward_id"],
                ward_name=ward["ward_name"],
                weather=WeatherData(**weather),
                drainage_coefficient=ward["drainage_coefficient"],
            )
            _cache[ward["ward_id"]] = {"result": result, "cached_at": datetime.utcnow()}
        results.append(_result_to_dict(result, include_color=True))
    return results


@router.get("/{ward_id}")
async def get_swapi_detail(ward_id: str, db: AsyncSession = Depends(get_db)):
    ward = _get_ward(ward_id)
    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    cached = _cache.get(ward_id)
    if cached and _cache_is_fresh(cached["cached_at"]):
        result = cached["result"]
    else:
        weather = WEATHER.get(ward_id)
        if not weather:
            raise HTTPException(status_code=404, detail="Weather not found")
        result = compute_swapi(
            ward_id=ward["ward_id"],
            ward_name=ward["ward_name"],
            weather=WeatherData(**weather),
            drainage_coefficient=ward["drainage_coefficient"],
        )
        _cache[ward_id] = {"result": result, "cached_at": datetime.utcnow()}

    citizen_count = (
        await db.execute(
            text("SELECT COUNT(*) FROM citizen_reports WHERE ward_id = :ward_id"),
            {"ward_id": ward_id},
        )
    ).scalar_one()
    pgc_count = (
        await db.execute(
            text("SELECT COUNT(*) FROM pgc_detections WHERE ward_id = :ward_id"),
            {"ward_id": ward_id},
        )
    ).scalar_one()

    payload = _result_to_dict(result, include_color=True)
    payload["citizen_report_count"] = citizen_count
    payload["pgc_detection_count"] = pgc_count
    return payload


@router.get("/stats/summary")
def get_swapi_summary():
    results = []
    for ward in WARDS:
        cached = _cache.get(ward["ward_id"])
        if cached and _cache_is_fresh(cached["cached_at"]):
            result = cached["result"]
        else:
            weather = WEATHER.get(ward["ward_id"])
            if not weather:
                continue
            result = compute_swapi(
                ward_id=ward["ward_id"],
                ward_name=ward["ward_name"],
                weather=WeatherData(**weather),
                drainage_coefficient=ward["drainage_coefficient"],
            )
            _cache[ward["ward_id"]] = {"result": result, "cached_at": datetime.utcnow()}
        results.append(result)

    counts = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
    for result in results:
        counts[result.risk_level] += 1

    return {
        "total_wards": len(results),
        "critical_count": counts["critical"],
        "high_count": counts["high"],
        "moderate_count": counts["moderate"],
        "low_count": counts["low"],
    }


@router.post("/compute")
def compute_swapi_on_demand(payload: ComputeRequest):
    ward_id = payload.ward_id or "DEMO"
    ward_name = payload.ward_name or "Demo Ward"
    weather = WeatherData(
        rainfall_3day_mm=payload.rainfall_3day_mm,
        humidity_percent=payload.humidity_percent,
        sunlight_hours=payload.sunlight_hours,
        temp_max=payload.temp_max,
        temp_min=payload.temp_min,
    )
    result = compute_swapi(
        ward_id=ward_id,
        ward_name=ward_name,
        weather=weather,
        drainage_coefficient=payload.drainage_coefficient,
    )
    return _result_to_dict(result, include_color=True)
