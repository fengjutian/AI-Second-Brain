"""Session persistence — current vault + recent vaults list.

Stored in backend/.session as JSON:
{
    "current": "D:\\brain-doc",
    "recent": [
        {"path": "D:\\brain-doc", "name": "brain-doc", "opened_at": "2026-06-30T12:00:00"}
    ]
}
"""
import os
import json
import threading
from datetime import datetime, timezone
from typing import Optional

SESSION_PATH = os.path.join(os.path.dirname(__file__), ".session")
MAX_RECENT = 10

_lock = threading.RLock()


def _read() -> dict:
    if os.path.exists(SESSION_PATH):
        try:
            with open(SESSION_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _write(data: dict):
    os.makedirs(os.path.dirname(SESSION_PATH), exist_ok=True)
    with open(SESSION_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_current() -> Optional[str]:
    """Return the current vault path from session, or None."""
    with _lock:
        data = _read()
        return data.get("current") or data.get("vault_path")  # legacy fallback


def get_recent() -> list[dict]:
    """Return recent vaults list, newest first."""
    with _lock:
        data = _read()
        return data.get("recent", [])


def set_current(path: str):
    """Set current vault and add to recent list."""
    with _lock:
        data = _read()
        # Migrate legacy format
        if not data:
            data = {}
        data["current"] = path

        # Update recent list
        recent: list = data.get("recent", [])
        name = os.path.basename(path.rstrip("/\\"))
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # Remove existing entry for this path (will re-add at front)
        recent = [r for r in recent if r.get("path") != path]
        recent.insert(0, {"path": path, "name": name, "opened_at": now})

        # Trim
        data["recent"] = recent[:MAX_RECENT]
        _write(data)


def remove_recent(path: str):
    """Remove a vault from the recent list."""
    with _lock:
        data = _read()
        recent: list = data.get("recent", [])
        data["recent"] = [r for r in recent if r.get("path") != path]
        _write(data)
