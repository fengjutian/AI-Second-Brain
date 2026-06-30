"""AI Second Brain — FastAPI Application Entry Point."""
import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from core.indexer import scan_vault
from core.watcher import start_watcher, stop_watcher
from data.database import connect, init_db
from api.notes import router as notes_router, set_vault_path
from api.search import router as search_router
from api.chat import router as chat_router
from api.graph import router as graph_router

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

# ---- Vault State ----
_vault_path: Optional[str] = None


def on_file_change(note_id: str, event_type: str):
    """Callback from file watcher — broadcast via WebSocket."""
    asyncio.run_coroutine_threadsafe(
        manager.broadcast({
            "type": f"note_{event_type}",
            "data": {"id": note_id},
        }),
        asyncio.get_event_loop(),
    ) if asyncio.get_event_loop().is_running() else None


# ---- App Lifecycle ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    global _vault_path
    # Startup: try to restore last vault from session file
    session_file = os.path.join(os.path.dirname(__file__), ".session")
    if os.path.exists(session_file):
        with open(session_file) as f:
            data = json.load(f)
            _vault_path = data.get("vault_path")

    if _vault_path and os.path.isdir(_vault_path):
        set_vault_path(_vault_path)
        print(f"[startup] Vault: {_vault_path}")
        conn = connect(_vault_path)
        init_db(conn)
        result = scan_vault(conn, _vault_path)
        print(f"[startup] Indexed {result['indexed']} notes, cleaned {result['deleted']}")
        conn.close()
        start_watcher(_vault_path, on_file_change)
    else:
        print("[startup] No vault open — waiting for /api/v1/vaults/open")

    yield

    # Shutdown
    stop_watcher()
    print("[shutdown] AI Second Brain backend stopped")


app = FastAPI(
    title="AI Second Brain",
    version="0.1.0",
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


# ---- Vault Management ----
@app.get("/api/v1/vaults")
async def get_vault():
    """Get current vault info."""
    if not _vault_path:
        return {"path": None, "name": None}
    return {"path": _vault_path, "name": os.path.basename(_vault_path)}


@app.post("/api/v1/vaults/open")
async def open_vault(data: dict):
    """Open or create a vault."""
    global _vault_path
    path = data["path"]
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)

    _vault_path = path
    set_vault_path(path)

    # Persist session
    session_file = os.path.join(os.path.dirname(__file__), ".session")
    with open(session_file, "w") as f:
        json.dump({"vault_path": path}, f)

    # Initialize and scan
    conn = connect(path)
    init_db(conn)
    result = scan_vault(conn, path)
    conn.close()

    # Start watcher
    start_watcher(path, on_file_change)

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
            # Handle client messages like subscribe
            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


# ---- Health ----
@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "0.1.0", "vault": _vault_path}
