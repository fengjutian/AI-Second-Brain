"""Graph data API."""
from fastapi import APIRouter, HTTPException
import sqlite3

import shared
from core.indexer import get_graph
from data.database import connect, init_db

router = APIRouter(prefix="/graph", tags=["graph"])


def _get_conn() -> sqlite3.Connection:
    vault = shared.get_vault_path()
    if not vault:
        raise HTTPException(500, "Vault not initialized")
    conn = connect(vault)
    init_db(conn)
    return conn


@router.get("/")
async def global_graph():
    conn = _get_conn()
    try:
        return get_graph(conn)
    finally:
        conn.close()


@router.get("/{note_id}/local")
async def local_graph(note_id: str, depth: int = 1):
    conn = _get_conn()
    try:
        return get_graph(conn, note_id, depth)
    finally:
        conn.close()
