"""Daily Note API."""
from fastapi import APIRouter
from datetime import date

import shared
from core.indexer import create_note, get_note
from data.database import connect, init_db

router = APIRouter(prefix="/daily", tags=["daily"])


@router.get("/today")
async def get_today():
    """Get or create today's daily note."""
    vault = shared.get_vault_path()
    if not vault:
        return {"error": "No vault open"}

    today = date.today().isoformat()
    rel_path = f"daily/{today}.md"

    conn = connect(vault)
    init_db(conn)

    # Check if exists
    row = conn.execute("SELECT id, path FROM notes WHERE path = ?", (rel_path,)).fetchone()
    if row:
        note = get_note(conn, vault, row["id"])
        conn.close()
        return note

    # Create new daily note
    note_id = create_note(conn, vault, rel_path)
    note = get_note(conn, vault, note_id)
    conn.close()
    return note


@router.get("/{date_str}")
async def get_daily(date_str: str):
    """Get a specific daily note by date (YYYY-MM-DD)."""
    vault = shared.get_vault_path()
    if not vault:
        return {"error": "No vault open"}

    rel_path = f"daily/{date_str}.md"
    conn = connect(vault)
    init_db(conn)
    row = conn.execute("SELECT id FROM notes WHERE path = ?", (rel_path,)).fetchone()

    if not row:
        conn.close()
        return {"error": "Not found"}

    note = get_note(conn, vault, row["id"])
    conn.close()
    return note
