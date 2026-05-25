from fastapi import APIRouter, Query

from rag.retriever import retrieve_context


router = APIRouter()


@router.get("/test")
async def rag_test(query: str = Query(..., min_length=2)):
    results = await retrieve_context(query, top_k=3)
    return {"query": query, "results": results}