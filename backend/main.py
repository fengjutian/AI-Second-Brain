"""AI Second Brain — FastAPI Application Entry Point."""
import os
import json
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from core.indexer import scan_vault
from core.watcher import start_watcher, stop_watcher
from core.embeddings import EmbeddingEngine
from core.rag import RAGEngine
from core.plugin_system import plugin_manager
from data.database import connect, init_db
import shared
from api.notes import router as notes_router
from api.search import router as search_router
from api.chat import router as chat_router
from api.graph import router as graph_router
from api.daily import router as daily_router
from api.import_api import router as import_router
from config import get_ai_config, set_ai_config
import session as app_session

# ---- WebSocket Manager ----
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, msg: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)

manager = ConnectionManager()
_main_loop: asyncio.AbstractEventLoop | None = None


def on_file_change(note_id: str, event_type: str):
    """Callback from file watcher — broadcast via WebSocket."""
    global _main_loop
    if _main_loop and _main_loop.is_running():
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({
                "type": f"note_{event_type}",
                "data": {"id": note_id},
            }),
            _main_loop,
        )


# ---- App Lifecycle ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    vault_path = app_session.get_current()

    if vault_path and os.path.isdir(vault_path):
        shared.set_vault_path(vault_path)
        global _main_loop
        _main_loop = asyncio.get_event_loop()
        print(f"[startup] Vault: {vault_path}")
        conn = connect(vault_path)
        init_db(conn)
        result = scan_vault(conn, vault_path)
        print(f"[startup] Indexed {result['indexed']} notes, cleaned {result['deleted']}")
        conn.close()
        start_watcher(vault_path, on_file_change)
    else:
        print("[startup] No vault open — waiting for /api/v1/vaults/open")

    yield

    stop_watcher()
    plugin_manager.deactivate_all()
    print("[shutdown] AI Second Brain backend stopped")


app = FastAPI(
    title="AI Second Brain",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
        "https://tauri.localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
from starlette.requests import Request

@app.exception_handler(Exception)
async def catch_all_handler(request: Request, exc: Exception):
    """Ensure CORS headers on all error responses."""
    import traceback
    traceback.print_exception(type(exc), exc, exc.__traceback__)
    detail = str(exc) if os.environ.get("DEBUG") else "Internal server error"
    return JSONResponse(
        status_code=500,
        content={"detail": detail},
    )


# ---- Routers ----
app.include_router(notes_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(graph_router, prefix="/api/v1")
app.include_router(daily_router, prefix="/api/v1")
app.include_router(import_router, prefix="/api/v1")


# ---- Config ----
@app.get("/api/v1/config/ai")
async def get_ai_config_endpoint():
    """Get AI configuration."""
    return get_ai_config()


@app.put("/api/v1/config/ai")
async def set_ai_config_endpoint(data: dict):
    """Update AI configuration (partial update)."""
    return set_ai_config(data)


# ---- Vault Management ----
@app.get("/api/v1/vaults")
async def get_vault():
    """Get current vault info + recent list."""
    path = shared.get_vault_path()
    recent = app_session.get_recent()
    if not path:
        return {"path": None, "name": None, "recent": recent}
    return {"path": path, "name": os.path.basename(path), "recent": recent}


@app.get("/api/v1/vaults/recent")
async def get_recent_vaults():
    """Get the list of recently opened vaults."""
    return {"recent": app_session.get_recent()}


@app.delete("/api/v1/vaults/recent/{path:path}")
async def remove_recent_vault(path: str):
    """Remove a vault from the recent list."""
    from urllib.parse import unquote
    app_session.remove_recent(unquote(path))
    return {"ok": True}


@app.post("/api/v1/vaults/open")
async def open_vault(data: dict):
    """Open or switch to a vault."""
    path = data["path"]
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)

    # If switching vaults, tear down old one first
    old_path = shared.get_vault_path()
    if old_path and old_path != path:
        stop_watcher()
        plugin_manager.deactivate_all()
        shared.set_embedding_engine(None)
        shared.set_rag_engine(None)

    shared.set_vault_path(path)

    # Capture event loop for file watcher callbacks
    global _main_loop
    _main_loop = asyncio.get_event_loop()

    # Persist session
    app_session.set_current(path)

    # Initialize and scan
    conn = connect(path)
    init_db(conn)
    result = scan_vault(conn, path)
    conn.close()

    # Initialize AI engines using persisted config
    try:
        ai_cfg = get_ai_config()
        emb_provider = ai_cfg.get("embedding_provider", "local")
        emb_model = ai_cfg.get("embedding_model") or None
        llm_provider = ai_cfg.get("llm_provider", "local")
        llm_model = ai_cfg.get("llm_model") or None

        emb_engine = EmbeddingEngine(path, provider=emb_provider, model_name=emb_model)
        rag_engine = RAGEngine(emb_engine, llm_provider=llm_provider, llm_model=llm_model, base_url=ai_cfg.get("ollama_base_url") or None)
        shared.set_embedding_engine(emb_engine)
        shared.set_rag_engine(rag_engine)
        print(f"[startup] AI engines ready — embeddings: {emb_engine.provider}/{emb_engine.model_name}, LLM: {rag_engine.llm_provider}/{rag_engine.llm_model}")
    except Exception as e:
        print(f"[startup] AI engines not available: {e}")
        shared.set_embedding_engine(None)
        shared.set_rag_engine(None)

    # Start watcher
    start_watcher(path, on_file_change)

    # Load + activate backend plugins
    n_plugins = plugin_manager.load_plugins(path)
    if n_plugins > 0:
        plugin_manager.activate_all(app)
        print(f"[startup] Loaded {n_plugins} backend plugin(s)")

    return {
        "path": path,
        "name": os.path.basename(path),
        "indexed": result["indexed"],
        "deleted": result["deleted"],
    }


# ---- WebSocket ----
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        import traceback
        traceback.print_exc()
        manager.disconnect(ws)


# ---- Health ----
@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "version": "0.2.0",
        "vault": shared.get_vault_path(),
        "ai": {
            "embeddings": shared.get_embedding_engine() is not None,
            "rag": shared.get_rag_engine() is not None,
        },
    }


# ---- AI Endpoints ----
@app.post("/api/v1/ai/suggest-tags")
async def suggest_tags(data: dict):
    engine = shared.get_rag_engine()
    if not engine:
        return {"tags": []}
    tags = await engine.suggest_tags(data.get("content", ""))
    return {"tags": tags}


@app.post("/api/v1/ai/summarize")
async def summarize_note(data: dict):
    engine = shared.get_rag_engine()
    if not engine:
        return {"summary": "AI 引擎未启用"}
    summary = await engine.summarize(data.get("content", ""))
    return {"summary": summary}


@app.post("/api/v1/ai/suggest-links")
async def suggest_links(data: dict):
    engine = shared.get_rag_engine()
    if not engine:
        return {"related": []}
    related = await engine.suggest_links(
        data.get("note_id", ""), data.get("content", "")
    )
    return {"related": related}
