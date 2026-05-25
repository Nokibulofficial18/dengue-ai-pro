from dataclasses import dataclass
from datetime import datetime
import math


WEIGHTS = {"w1": 0.35, "w2": 0.25, "w3": 0.20, "w4": 0.10, "w5": 0.10}


@dataclass
class WeatherData:
    rainfall_3day_mm: float
    humidity_percent: float
    sunlight_hours: float
    temp_max: float
    temp_min: float


@dataclass
class SWAPIResult:
    ward_id: str
    ward_name: str
    score: float
    risk_level: str
    rainfall_contribution: float
    humidity_contribution: float
    sunlight_contribution: float
    temp_contribution: float
    drainage_contribution: float
    computed_at: str


def normalize_rainfall(mm: float) -> float:
    # 0mm = 0, 60mm+ = 1.0 (sigmoid-like)
    return min(mm / 60.0, 1.0)


def normalize_humidity(percent: float) -> float:
    return percent / 100.0


def normalize_sunlight(hours: float) -> float:
    # More sunlight = more evaporation = lower risk, so invert
    return hours / 12.0  # max 12 hours


def normalize_temp_range(temp_max: float, temp_min: float) -> float:
    # Narrow range = high humidity retention = higher risk
    # range 0-5 = high risk (1.0), range >15 = low risk (0.0)
    t_range = temp_max - temp_min
    return max(0, 1.0 - (t_range / 15.0))


def get_risk_level(score: float) -> str:
    if score < -0.3:
        return "low"
    if score < 0.5:
        return "moderate"
    if score < 0.7:
        return "high"
    return "critical"


def get_risk_color(score: float) -> str:
    if score < -0.3:
        return "#1E6B2E"
    if score < 0.5:
        return "#E8A020"
    if score < 0.7:
        return "#C05A1A"
    return "#C0392B"


def compute_swapi(
    ward_id: str,
    ward_name: str,
    weather: WeatherData,
    drainage_coefficient: float,
) -> SWAPIResult:
    R = normalize_rainfall(weather.rainfall_3day_mm)
    H = normalize_humidity(weather.humidity_percent)
    S = normalize_sunlight(weather.sunlight_hours)
    T = normalize_temp_range(weather.temp_max, weather.temp_min)
    D = 1.0 - drainage_coefficient  # inverse drainage

    w = WEIGHTS
    raw = w["w1"] * R + w["w2"] * H + w["w3"] * (1 - S) + w["w4"] * T + w["w5"] * D
    score = math.tanh(raw * 2)  # scale before tanh for better spread
    score = round(max(-1.0, min(1.0, score)), 3)

    # Compute percentage contributions
    total = (
        abs(w["w1"] * R)
        + abs(w["w2"] * H)
        + abs(w["w3"] * (1 - S))
        + abs(w["w4"] * T)
        + abs(w["w5"] * D)
    )

    return SWAPIResult(
        ward_id=ward_id,
        ward_name=ward_name,
        score=score,
        risk_level=get_risk_level(score),
        rainfall_contribution=round(w["w1"] * R / total * 100, 1) if total > 0 else 0,
        humidity_contribution=round(w["w2"] * H / total * 100, 1) if total > 0 else 0,
        sunlight_contribution=round(w["w3"] * (1 - S) / total * 100, 1) if total > 0 else 0,
        temp_contribution=round(w["w4"] * T / total * 100, 1) if total > 0 else 0,
        drainage_contribution=round(w["w5"] * D / total * 100, 1) if total > 0 else 0,
        computed_at=datetime.now().isoformat(),
    )
