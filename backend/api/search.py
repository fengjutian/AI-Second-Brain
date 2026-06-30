"""Full-text + Semantic search API."""
from fastapi import APIRouter, HTTPException, Query

from core.indexer import search_fts
from data.database import connect, init_db
from api.notes import _vault_path
from main import get_embedding_engine

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def keyword_search(
    q: str = Query(..., description="Search query"), limit: int = 20
):
    """Keyword search via SQLite FTS5."""
    if not _vault_path:
        raise HTTPException(500, "Vault not initialized")

    conn = connect(_vault_path)
    init_db(conn)
    try:
        results = search_fts(conn, q, limit)
        return results
    finally:
        conn.close()


@router.get("/semantic")
async def semantic_search(
    q: str = Query(...), limit: int = 10
):
    """Semantic search via ChromaDB embeddings."""
    engine = get_embedding_engine()
    if not engine:
        return []  # Graceful degradation

    results = engine.semantic_search(q, limit)
    return results
