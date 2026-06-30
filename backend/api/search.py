"""Full-text + Semantic search API."""
from fastapi import APIRouter, HTTPException, Query
import sqlite3

import shared
from core.indexer import search_fts
from data.database import connect, init_db

router = APIRouter(prefix="/search", tags=["search"])


def _get_conn() -> sqlite3.Connection:
    vault = shared.get_vault_path()
    if not vault:
        raise HTTPException(500, "Vault not initialized")
    conn = connect(vault)
    init_db(conn)
    return conn


@router.get("/")
async def keyword_search(q: str = Query(..., description="Search query"), limit: int = 20):
    conn = _get_conn()
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
