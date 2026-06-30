"""Shared global state — thread-safe singleton for cross-module state."""
import threading
from typing import Optional
from core.embeddings import EmbeddingEngine
from core.rag import RAGEngine

_lock = threading.RLock()

_vault_path: Optional[str] = None
_embedding_engine: Optional[EmbeddingEngine] = None
_rag_engine: Optional[RAGEngine] = None


def set_vault_path(path: str):
    with _lock:
        global _vault_path
        _vault_path = path


def get_vault_path() -> Optional[str]:
    with _lock:
        return _vault_path


def set_embedding_engine(engine: Optional[EmbeddingEngine]):
    with _lock:
        global _embedding_engine
        _embedding_engine = engine


def get_embedding_engine() -> Optional[EmbeddingEngine]:
    with _lock:
        return _embedding_engine


def set_rag_engine(engine: Optional[RAGEngine]):
    with _lock:
        global _rag_engine
        _rag_engine = engine


def get_rag_engine() -> Optional[RAGEngine]:
    with _lock:
        return _rag_engine
