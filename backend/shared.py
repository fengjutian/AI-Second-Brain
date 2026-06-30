"""Shared global state — avoids circular imports between main and api modules."""
from typing import Optional
from core.embeddings import EmbeddingEngine
from core.rag import RAGEngine

_vault_path: Optional[str] = None
_embedding_engine: Optional[EmbeddingEngine] = None
_rag_engine: Optional[RAGEngine] = None


def set_vault_path(path: str):
    global _vault_path
    _vault_path = path


def get_vault_path() -> Optional[str]:
    return _vault_path


def set_embedding_engine(engine: Optional[EmbeddingEngine]):
    global _embedding_engine
    _embedding_engine = engine


def get_embedding_engine() -> Optional[EmbeddingEngine]:
    return _embedding_engine


def set_rag_engine(engine: Optional[RAGEngine]):
    global _rag_engine
    _rag_engine = engine


def get_rag_engine() -> Optional[RAGEngine]:
    return _rag_engine
