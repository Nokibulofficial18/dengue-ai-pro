import os
import json
import httpx
from dataclasses import dataclass, asdict

from demo_data import DISPATCH_ORDERS, LLM_QA
from rag.retriever import build_rag_context


DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "demo")

SYSTEM_PROMPT = """You are a public health dispatch advisor for Dhaka 
city corporation dengue prevention operations. You receive real-time 
ward SWAPI risk scores, GPS water detections, citizen reports, and 
WHO/DGHS knowledge context.

For each high-risk ward respond ONLY with valid JSON:
{
  "ward_id": "string",
  "ward_name": "string",
  "priority_rank": 1,
  "swapi_score": 0.91,
  "top_risk_factors": ["factor1", "factor2"],
  "recommended_officers": 4,
  "larvicide_litres": 22.0,
  "target_sector": "description",
  "reasoning": "2-3 sentences",
  "rag_citation": "source and key fact"
}

Base recommendations strictly on provided SWAPI data and RAG context.
Always cite your WHO or DGHS source."""


async def call_claude(user_message: str) -> str | None:
    if DEMO_MODE or ANTHROPIC_API_KEY == "demo":
        return None  # Will use fallback

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-3-5-sonnet-20241022",
                "max_tokens": 1024,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_message}],
            },
        )
        data = response.json()
        return data["content"][0]["text"]


async def generate_dispatch_order(ward: dict, swapi_result: dict) -> dict:
    # Try real Claude first
    rag_context = await build_rag_context(
        ward["ward_id"], swapi_result["score"], ward["ward_name"]
    )

    user_msg = f"""Generate dispatch order for:
Ward: {ward["ward_name"]} (ID: {ward["ward_id"]})
SWAPI Score: {swapi_result["score"]} ({swapi_result["risk_level"].upper()})
Top risk factors: rainfall {swapi_result["rainfall_contribution"]}%, 
humidity {swapi_result["humidity_contribution"]}%
Citizen reports (24h): {swapi_result.get("report_count", 0)}
Water patches detected: {swapi_result.get("pgc_count", 0)}

{rag_context}"""

    llm_response = await call_claude(user_msg)

    if llm_response:
        try:
            return json.loads(llm_response)
        except Exception:
            pass

    # Fallback: find in mock data or generate rule-based
    mock = next(
        (o for o in DISPATCH_ORDERS if o["ward_id"] == ward["ward_id"]), None
    )
    if mock:
        return mock

    # Rule-based fallback
    score = swapi_result["score"]
    officers = max(1, int(score * 5))
    return {
        "ward_id": ward["ward_id"],
        "ward_name": ward["ward_name"],
        "priority_rank": 1,
        "swapi_score": score,
        "top_risk_factors": [
            f"Rainfall contribution: {swapi_result['rainfall_contribution']}%",
            f"Humidity contribution: {swapi_result['humidity_contribution']}%",
        ],
        "recommended_officers": officers,
        "larvicide_litres": round(officers * 5.5, 1),
        "target_sector": "High-density residential and construction areas",
        "reasoning": f"{ward['ward_name']} has SWAPI score {score:.2f} indicating {swapi_result['risk_level']} dengue risk. Immediate larviciding recommended based on WHO breeding cycle threshold.",
        "rag_citation": "WHO: act before 4-5 day breeding cycle completes at >25°C.",
    }


async def answer_authority_query(question: str, all_swapi: list) -> dict:
    # Check demo Q&A dict first for exact match
    for key in LLM_QA:
        if key.lower() in question.lower() or question.lower() in key.lower():
            return {
                "answer": LLM_QA[key],
                "source": "RAG-grounded response",
                "mode": "demo",
            }

    # Try Claude if API key available
    rag_context = await build_rag_context("all", 0.8, "Dhaka")

    ward_summary = "\n".join(
        [
            f"- {w['ward_name']}: SWAPI {w['score']} ({w['risk_level']})"
            for w in sorted(all_swapi, key=lambda x: x["score"], reverse=True)[:5]
        ]
    )

    user_msg = f"""Authority question: {question}

Current top ward risk scores:
{ward_summary}

{rag_context}

Answer concisely in under 150 words. Include specific numbers and cite sources."""

    llm_response = await call_claude(user_msg)
    if llm_response:
        return {"answer": llm_response, "source": "Claude AI + RAG", "mode": "live"}

    # Generic fallback
    return {
        "answer": f"Based on current SWAPI scores, the highest risk wards are: {ward_summary}\n\nFor specific dispatch recommendations, check the dispatch queue. All recommendations are grounded in WHO dengue vector control protocols.",
        "source": "Rule-based response (demo mode)",
        "mode": "demo",
    }
