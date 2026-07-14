"""Graph data API."""
from fastapi import APIRouter, HTTPException

import shared
from core.indexer import get_graph
from api import get_conn

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/")
async def global_graph():
    try:
        conn = get_conn()
        return get_graph(conn)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to load graph: {e}")
    finally:
        if "conn" in locals():
            conn.close()


@router.get("/{note_id}/local")
async def local_graph(note_id: str, depth: int = 1):
    try:
        conn = get_conn()
        return get_graph(conn, note_id, depth)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to load graph: {e}")
    finally:
        if "conn" in locals():
            conn.close()
