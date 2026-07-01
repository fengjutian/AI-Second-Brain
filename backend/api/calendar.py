"""Calendar API — notes grouped by creation date."""
from fastapi import APIRouter

from api import get_conn
from core.indexer import get_note
import shared

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/")
async def get_calendar(year: int | None = None, month: int | None = None):
    """Get notes grouped by creation date.
    If year/month provided, filter to that month.
    Otherwise return all dates.
    """
    vault = shared.get_vault_path()
    if not vault:
        return {}

    conn = get_conn()
    try:
        if year and month:
            prefix = f"{year:04d}-{month:02d}"
            rows = conn.execute(
                """SELECT id, title, path, created
                   FROM notes
                   WHERE created LIKE ? || '%'
                   ORDER BY created DESC""",
                (prefix,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, title, path, created
                   FROM notes
                   ORDER BY created DESC"""
            ).fetchall()

        grouped: dict[str, list[dict]] = {}
        for r in rows:
            day = r["created"][:10]
            if day not in grouped:
                grouped[day] = []
            grouped[day].append({
                "id": r["id"],
                "title": r["title"],
                "path": r["path"],
                "created": r["created"],
            })
        return grouped
    finally:
        conn.close()
