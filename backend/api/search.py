"""Full-text & semantic search API — stubs"""
from fastapi import APIRouter, Query

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def keyword_search(q: str = Query(...), limit: int = 20):
    """Keyword search via SQLite FTS5"""
    return []


@router.get("/semantic")
async def semantic_search(q: str = Query(...), limit: int = 10):
    """Semantic search via ChromaDB"""
    return []
