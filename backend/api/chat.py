"""AI Chat API — RAG-powered question answering."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import shared

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/")
async def chat(data: dict):
    engine = shared.get_rag_engine()
    if not engine:
        raise HTTPException(503, "AI engine not available. Open a vault first.")

    messages = data.get("messages", [])
    if not messages:
        raise HTTPException(400, "No messages provided")

    user_message = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"),
        messages[-1]["content"],
    )

    result = await engine.query(user_message)
    return result


@router.post("/stream")
async def chat_stream(data: dict):
    engine = shared.get_rag_engine()
    if not engine:
        raise HTTPException(503, "AI engine not available.")

    messages = data.get("messages", [])
    if not messages:
        raise HTTPException(400, "No messages provided")

    user_message = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"),
        messages[-1]["content"],
    )

    async def generate():
        async for chunk in engine.query_stream(user_message):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
