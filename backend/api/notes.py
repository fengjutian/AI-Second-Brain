"""Notes CRUD API — stubs for MVP"""
from fastapi import APIRouter

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/")
async def list_notes():
    """List all notes"""
    return []


@router.get("/{note_id}")
async def get_note(note_id: str):
    """Get a single note"""
    return {"id": note_id, "title": "stub"}


@router.post("/")
async def create_note():
    """Create a new note"""
    return {"id": "new-id"}
