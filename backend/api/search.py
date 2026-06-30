"""Full-text search API."""
from fastapi import APIRouter, HTTPException, Query
import sqlite3

from core.indexer import search_fts
from data.database import connect, init_db

router = APIRouter(prefix="/search", tags=["search"])

# Import vault path from notes module
from api.notes import _vault_path


def _get_conn() -> sqlite3.Connection:
    if not _vault_path:
        raise HTTPException(500, "Vault not initialized")
    conn = connect(_vault_path)
    init_db(conn)
    return conn


@router.get("/")
async def keyword_search(q: str = Query(..., description="Search query"), limit: int = 20):
    """Keyword search via SQLite FTS5."""
    conn = _get_conn()
    try:
        results = search_fts(conn, q, limit)
        return results
    finally:
        conn.close()


@router.get("/semantic")
async def semantic_search(q: str = Query(...), limit: int = 10):
    """Semantic search via ChromaDB (stub — returns empty)."""
    # TODO: Implement ChromaDB semantic search
    return []
