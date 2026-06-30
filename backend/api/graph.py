"""Graph data API — stubs"""
from fastapi import APIRouter

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/")
async def global_graph():
    """Get global graph nodes and edges"""
    return {"nodes": [], "edges": []}


@router.get("/{note_id}/local")
async def local_graph(note_id: str, depth: int = 1):
    """Get local graph for a note"""
    return {"nodes": [], "edges": []}
