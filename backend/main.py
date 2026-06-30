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


def on_file_change(note_id: str, event_type: str):
    """Callback from file watcher — broadcast via WebSocket."""
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({
                "type": f"note_{event_type}",
                "data": {"id": note_id},
            }),
            loop,
        )


# ---- App Lifecycle ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    vault_path = None
    session_file = os.path.join(os.path.dirname(__file__), ".session")
    if os.path.exists(session_file):
        with open(session_file) as f:
            data = json.load(f)
            vault_path = data.get("vault_path")

    if vault_path and os.path.isdir(vault_path):
        shared.set_vault_path(vault_path)
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
        "tauri://localhost",
        "https://tauri.localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
app.include_router(notes_router, prefix="/api/v1")
app.include_router(search_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(graph_router, prefix="/api/v1")
app.include_router(daily_router, prefix="/api/v1")
app.include_router(import_router, prefix="/api/v1")


# ---- Vault Management ----
@app.get("/api/v1/vaults")
async def get_vault():
    """Get current vault info."""
    path = shared.get_vault_path()
    if not path:
        return {"path": None, "name": None}
    return {"path": path, "name": os.path.basename(path)}


@app.post("/api/v1/vaults/open")
async def open_vault(data: dict):
    """Open or create a vault."""
    path = data["path"]
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)

    shared.set_vault_path(path)

    # Persist session
    session_file = os.path.join(os.path.dirname(__file__), ".session")
    with open(session_file, "w") as f:
        json.dump({"vault_path": path}, f)

    # Initialize and scan
    conn = connect(path)
    init_db(conn)
    result = scan_vault(conn, path)
    conn.close()

    # Initialize AI engines
    try:
        emb_engine = EmbeddingEngine(path, provider="local")
        rag_engine = RAGEngine(emb_engine, llm_provider="local")
        shared.set_embedding_engine(emb_engine)
        shared.set_rag_engine(rag_engine)
        print(f"[startup] AI engines ready — embeddings: {emb_engine.provider}, LLM: {rag_engine.llm_provider}")
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
    except Exception:
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
