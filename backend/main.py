from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Second Brain", version="0.1.0")

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


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.on_event("startup")
async def startup():
    # TODO: init SQLite + ChromaDB + file watcher
    print("[startup] AI Second Brain backend started")


@app.on_event("shutdown")
async def shutdown():
    # TODO: cleanup
    print("[shutdown] AI Second Brain backend stopped")
