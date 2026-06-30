"""AI Chat API — stubs"""
from fastapi import APIRouter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/")
async def chat():
    """AI chat endpoint"""
    return {"answer": "AI chat coming soon", "sources": []}
