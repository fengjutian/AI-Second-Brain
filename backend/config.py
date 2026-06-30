"""App-level configuration — persisted to backend/.config JSON file.

Separate from vault-specific data. Stores AI provider preferences,
API keys, and other cross-vault settings.
"""
import os
import json
import threading
from typing import Optional

CONFIG_PATH = os.path.join(os.path.dirname(__file__), ".config")

_lock = threading.RLock()

DEFAULT_AI_CONFIG: dict = {
    "embedding_provider": "local",
    "embedding_model": None,       # None → use provider default
    "llm_provider": "local",
    "llm_model": None,
    "api_key_openai": "",
    "ollama_base_url": "http://localhost:11434/v1",
}


def _read_raw() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _write_raw(data: dict):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_ai_config() -> dict:
    """Return the current AI configuration, merging with defaults."""
    with _lock:
        raw = _read_raw()
        ai = raw.get("ai", {})
        merged = {**DEFAULT_AI_CONFIG, **ai}
        return merged


def set_ai_config(updates: dict) -> dict:
    """Merge partial AI config updates and persist. Returns the new full config."""
    with _lock:
        raw = _read_raw()
        ai = raw.get("ai", {})
        # Only allow known keys
        for k in updates:
            if k in DEFAULT_AI_CONFIG:
                ai[k] = updates[k]
        # Clean: remove keys that match defaults (keep file lean)
        clean_ai = {k: v for k, v in ai.items() if v != DEFAULT_AI_CONFIG.get(k)}
        raw["ai"] = clean_ai
        _write_raw(raw)

    return get_ai_config()
