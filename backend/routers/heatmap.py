from datetime import datetime

from fastapi import APIRouter

from demo_data import WEATHER, WARDS
from models.swapi_model import WeatherData, compute_swapi, get_risk_color
from routers.swapi import _cache, _cache_is_fresh


router = APIRouter(prefix="/heatmap")


@router.get("/wards")
def get_heatmap_wards():
    results = []
    for ward in WARDS:
        cached = _cache.get(ward["ward_id"])
        if cached and _cache_is_fresh(cached["cached_at"]):
            swapi = cached["result"]
        else:
            weather = WEATHER.get(ward["ward_id"])
            if not weather:
                continue
            swapi = compute_swapi(
                ward_id=ward["ward_id"],
                ward_name=ward["ward_name"],
                weather=WeatherData(**weather),
                drainage_coefficient=ward["drainage_coefficient"],
            )
            _cache[ward["ward_id"]] = {"result": swapi, "cached_at": datetime.utcnow()}

        lat = ward["lat"]
        lon = ward["lon"]
        bounds = [[lat - 0.01, lon - 0.01], [lat + 0.01, lon + 0.01]]

        results.append(
            {
                "ward_id": ward["ward_id"],
                "ward_name": ward["ward_name"],
                "lat": lat,
                "lon": lon,
                "swapi_score": swapi.score,
                "risk_level": swapi.risk_level,
                "color": get_risk_color(swapi.score),
                "opacity": 0.75,
                "bounds": bounds,
            }
        )
    return results
