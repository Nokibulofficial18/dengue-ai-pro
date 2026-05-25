from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from agents.dispatch_agent import answer_authority_query, generate_dispatch_order
from db.database import get_db
from demo_data import WEATHER, WARDS
from models.swapi_model import WeatherData, compute_swapi


router = APIRouter(prefix="/dispatch")


class QueryRequest(BaseModel):
    question: str


class ConfirmRequest(BaseModel):
    officer_id: str


async def _get_counts(db: AsyncSession, ward_id: str) -> tuple[int, int]:
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
    return int(citizen_count), int(pgc_count)


async def _get_all_swapi(db: AsyncSession) -> list[dict]:
    results = []
    for ward in WARDS:
        weather = WEATHER.get(ward["ward_id"])
        if not weather:
            continue
        swapi = compute_swapi(
            ward_id=ward["ward_id"],
            ward_name=ward["ward_name"],
            weather=WeatherData(**weather),
            drainage_coefficient=ward["drainage_coefficient"],
        )
        citizen_count, pgc_count = await _get_counts(db, ward["ward_id"])
        results.append(
            {
                "ward_id": swapi.ward_id,
                "ward_name": swapi.ward_name,
                "score": swapi.score,
                "risk_level": swapi.risk_level,
                "rainfall_contribution": swapi.rainfall_contribution,
                "humidity_contribution": swapi.humidity_contribution,
                "sunlight_contribution": swapi.sunlight_contribution,
                "temp_contribution": swapi.temp_contribution,
                "drainage_contribution": swapi.drainage_contribution,
                "computed_at": swapi.computed_at,
                "report_count": citizen_count,
                "pgc_count": pgc_count,
            }
        )
    return results


async def _save_dispatch_order(db: AsyncSession, order: dict) -> dict:
    created_at = order.get("created_at") or datetime.utcnow().isoformat()
    status = order.get("status") or "pending"
    insert_sql = text(
        """
        INSERT INTO dispatch_orders
        (ward_id, ward_name, swapi_score, officer_count, larvicide_litres,
         target_sector, llm_reasoning, rag_citation, status, created_at)
        VALUES
        (:ward_id, :ward_name, :swapi_score, :officer_count, :larvicide_litres,
         :target_sector, :llm_reasoning, :rag_citation, :status, :created_at)
        """
    )
    await db.execute(
        insert_sql,
        {
            "ward_id": order.get("ward_id"),
            "ward_name": order.get("ward_name"),
            "swapi_score": order.get("swapi_score"),
            "officer_count": order.get("recommended_officers")
            or order.get("officer_count"),
            "larvicide_litres": order.get("larvicide_litres"),
            "target_sector": order.get("target_sector"),
            "llm_reasoning": order.get("reasoning")
            or order.get("llm_reasoning"),
            "rag_citation": order.get("rag_citation"),
            "status": status,
            "created_at": created_at,
        },
    )
    await db.commit()

    order["status"] = status
    order["created_at"] = created_at
    order["officer_count"] = order.get("recommended_officers") or order.get(
        "officer_count"
    )
    return order


@router.get("/queue")
async def get_dispatch_queue(db: AsyncSession = Depends(get_db)):
    all_swapi = await _get_all_swapi(db)
    top_wards = sorted(all_swapi, key=lambda x: x["score"], reverse=True)[:5]

    orders = []
    for index, ward_swapi in enumerate(top_wards, start=1):
        ward = next(
            w for w in WARDS if w["ward_id"] == ward_swapi["ward_id"]
        )
        order = await generate_dispatch_order(ward, ward_swapi)
        order.setdefault("priority_rank", index)
        order.setdefault("swapi_score", ward_swapi["score"])
        orders.append(await _save_dispatch_order(db, order))

    orders.sort(key=lambda x: x.get("priority_rank", 99))
    return orders


@router.post("/query")
async def dispatch_query(payload: QueryRequest, db: AsyncSession = Depends(get_db)):
    all_swapi = await _get_all_swapi(db)
    response = await answer_authority_query(payload.question, all_swapi)
    return {
        "answer": response.get("answer"),
        "source": response.get("source"),
        "citations": response.get("citations", []),
    }


@router.post("/{ward_id}/confirm")
async def confirm_dispatch_order(
    ward_id: str, payload: ConfirmRequest, db: AsyncSession = Depends(get_db)
):
    order_id = (
        await db.execute(
            text(
                "SELECT id FROM dispatch_orders WHERE ward_id = :ward_id ORDER BY created_at DESC LIMIT 1"
            ),
            {"ward_id": ward_id},
        )
    ).scalar()

    if not order_id:
        raise HTTPException(status_code=404, detail="Dispatch order not found")

    await db.execute(
        text("UPDATE dispatch_orders SET status = 'confirmed' WHERE id = :id"),
        {"id": order_id},
    )
    await db.commit()

    row = (
        await db.execute(
            text("SELECT * FROM dispatch_orders WHERE id = :id"), {"id": order_id}
        )
    ).mappings().first()
    result = dict(row) if row else {}
    result["officer_id"] = payload.officer_id
    return result


@router.get("/orders")
async def list_dispatch_orders(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            text("SELECT * FROM dispatch_orders ORDER BY created_at DESC")
        )
    ).mappings().all()
    return [dict(row) for row in rows]
