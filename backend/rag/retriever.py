from demo_data import WHO_KNOWLEDGE
import numpy as np
import os
import httpx

# In-memory knowledge store
_knowledge_store = []  # list of {content, source, embedding}
_embeddings_ready = False


def simple_word_overlap_score(query: str, text: str) -> float:
    # Fallback similarity using word overlap (TF-IDF-like)
    query_words = set(query.lower().split())
    text_words = set(text.lower().split())
    if not query_words or not text_words:
        return 0.0
    overlap = len(query_words & text_words)
    return overlap / (len(query_words) + len(text_words) - overlap)


async def get_embedding(text: str) -> list[float]:
    # Try OpenAI API, fall back to random if no key
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key == "demo":
        # Deterministic fake embedding based on word hashing
        np.random.seed(hash(text[:50]) % 2**31)
        return np.random.randn(1536).tolist()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"input": text[:512], "model": "text-embedding-3-small"},
        )
        return response.json()["data"][0]["embedding"]


def cosine_similarity(a: list, b: list) -> float:
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


async def init_knowledge_base():
    global _knowledge_store, _embeddings_ready
    if _knowledge_store:
        _embeddings_ready = True
        return
    for item in WHO_KNOWLEDGE:
        embedding = await get_embedding(item["content"])
        _knowledge_store.append(
            {
                "content": item["content"],
                "source": item["source"],
                "embedding": embedding,
            }
        )
    _embeddings_ready = True


async def retrieve_context(query: str, top_k: int = 3) -> list[dict]:
    if not _knowledge_store:
        await init_knowledge_base()

    query_embedding = await get_embedding(query)

    scores = []
    for item in _knowledge_store:
        if _embeddings_ready:
            sim = cosine_similarity(query_embedding, item["embedding"])
        else:
            sim = simple_word_overlap_score(query, item["content"])
        scores.append((sim, item))

    scores.sort(key=lambda x: x[0], reverse=True)
    return [
        {
            "content": item["content"],
            "source": item["source"],
            "similarity": round(score, 3),
        }
        for score, item in scores[:top_k]
    ]


async def build_rag_context(ward_id: str, swapi_score: float, ward_name: str) -> str:
    query = (
        f"dengue risk ward {ward_name} SWAPI score {swapi_score} "
        "rainfall humidity breeding sites prevention dispatch"
    )
    chunks = await retrieve_context(query)

    context = "RETRIEVED KNOWLEDGE BASE CONTEXT:\n\n"
    for i, chunk in enumerate(chunks, 1):
        context += f"[{i}] SOURCE: {chunk['source']}\n"
        context += f"{chunk['content']}\n\n"
    return context
