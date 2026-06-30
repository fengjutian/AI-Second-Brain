"""Full-text + Semantic search API."""
from fastapi import APIRouter, HTTPException, Query

import shared
from core.indexer import search_fts
from api import get_conn

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def keyword_search(q: str = Query(..., description="Search query"), limit: int = 20):
    conn = get_conn()
    try:
        return search_fts(conn, q, limit)
    finally:
        conn.close()


@router.get("/semantic")
async def semantic_search(q: str = Query(...), limit: int = 10):
    engine = shared.get_embedding_engine()
    if not engine:
        return []
    return engine.semantic_search(q, limit)
