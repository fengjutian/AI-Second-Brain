"""Graph data API."""
from fastapi import APIRouter, HTTPException
import sqlite3

from core.indexer import get_graph
from data.database import connect, init_db
from api.notes import _vault_path

router = APIRouter(prefix="/graph", tags=["graph"])


def _get_conn() -> sqlite3.Connection:
    if not _vault_path:
        raise HTTPException(500, "Vault not initialized")
    conn = connect(_vault_path)
    init_db(conn)
    return conn


@router.get("/")
async def global_graph():
    """Get global graph data."""
    conn = _get_conn()
    try:
        return get_graph(conn)
    finally:
        conn.close()


@router.get("/{note_id}/local")
async def local_graph(note_id: str, depth: int = 1):
    """Get local graph for a specific note."""
    conn = _get_conn()
    try:
        return get_graph(conn, note_id, depth)
    finally:
        conn.close()
