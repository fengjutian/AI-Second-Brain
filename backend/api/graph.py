"""Graph data API."""
from fastapi import APIRouter, HTTPException

import shared
from core.indexer import get_graph
from api import get_conn

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/")
async def global_graph():
    conn = get_conn()
    try:
        return get_graph(conn)
    finally:
        conn.close()


@router.get("/{note_id}/local")
async def local_graph(note_id: str, depth: int = 1):
    conn = get_conn()
    try:
        return get_graph(conn, note_id, depth)
    finally:
        conn.close()
