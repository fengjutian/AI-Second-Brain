"""Embeddings engine — ChromaDB vector storage + embedding generation."""
import os
import json
import threading
import chromadb
from chromadb.config import Settings
from typing import Optional

# Try to import sentence-transformers for local embeddings
try:
    from sentence_transformers import SentenceTransformer
    HAS_LOCAL_EMBEDDINGS = True
except ImportError:
    HAS_LOCAL_EMBEDDINGS = False

# Try OpenAI for cloud embeddings
try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


class EmbeddingEngine:
    """Manages ChromaDB collection and embedding generation."""

    def __init__(self, vault_path: str, provider: str = "local", model_name: str = None):
        self.vault_path = vault_path
        self.provider = provider  # "local" | "openai"
        self.model_name = model_name or self._default_model()
        self._model = None
        self._client = None
        self._load_lock = threading.Lock()
        self._write_lock = threading.Lock()

        # ChromaDB persistence directory
        chroma_dir = os.path.join(vault_path, "data", "chroma")
        os.makedirs(chroma_dir, exist_ok=True)

        self.chroma_client = chromadb.PersistentClient(
            path=chroma_dir,
            settings=Settings(anonymized_telemetry=False),
        )
        self.collection = self.chroma_client.get_or_create_collection(
            name="notes",
            metadata={"hnsw:space": "cosine"},
        )

    def _default_model(self) -> str:
        if self.provider == "local":
            return "all-MiniLM-L6-v2"  # 384-dim, fast, good enough
        return "text-embedding-3-small"  # OpenAI

    def _load_model(self):
        """Lazy-load the embedding model (thread-safe)."""
        if self._model is not None or self._client is not None:
            return

        with self._load_lock:
            # Double-check inside lock
            if self._model is not None or self._client is not None:
                return

            if self.provider == "local":
                if not HAS_LOCAL_EMBEDDINGS:
                    raise RuntimeError("sentence-transformers not installed. Run: pip install sentence-transformers")
                self._model = SentenceTransformer(self.model_name)
            elif self.provider == "openai":
                if not HAS_OPENAI:
                    raise RuntimeError("openai not installed. Run: pip install openai")
                self._client = OpenAI()
            else:
                raise ValueError(f"Unknown embedding provider: {self.provider}")

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of text strings."""
        self._load_model()

        if self.provider == "local":
            embeddings = self._model.encode(texts, show_progress_bar=False)
            return embeddings.tolist()

        elif self.provider == "openai":
            resp = self._client.embeddings.create(
                model=self.model_name,
                input=texts,
            )
            return [d.embedding for d in resp.data]

    def index_note(self, note_id: str, title: str, content: str, tags: list[str] = None, updated: str = ""):
        """Index or update a single note in ChromaDB (thread-safe)."""
        document = f"{title}\n\n{content}"
        embedding = self.embed([document])[0]

        with self._write_lock:
            existing = self.collection.get(ids=[note_id])
            if existing and existing["ids"]:
                self.collection.delete(ids=[note_id])

            self.collection.add(
                ids=[note_id],
                embeddings=[embedding],
                documents=[document],
                metadatas=[{
                    "title": title,
                    "tags": ",".join(tags) if tags else "",
                    "updated": updated,
                }],
            )

    def delete_note(self, note_id: str):
        """Remove a note from ChromaDB (thread-safe)."""
        with self._write_lock:
            try:
                self.collection.delete(ids=[note_id])
            except Exception as e:
                print(f"[embeddings] Failed to delete note {note_id} from ChromaDB: {e}")

    def semantic_search(self, query: str, limit: int = 10) -> list[dict]:
        """Search notes semantically by query string."""
        if self.collection.count() == 0:
            return []

        query_embedding = self.embed([query])[0]

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=min(limit, self.collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        if not results or not results["ids"] or not results["ids"][0]:
            return []

        output = []
        for i, note_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            doc = results["documents"][0][i] if results["documents"] else ""
            distance = results["distances"][0][i] if results["distances"] else 1.0
            # Cosine distance → similarity score (0-1)
            score = max(0, 1 - distance)

            # Extract a snippet
            snippet = doc[:300] + "..." if len(doc) > 300 else doc

            output.append({
                "note_id": note_id,
                "title": meta.get("title", ""),
                "snippet": snippet,
                "score": round(score, 4),
            })

        return output

    def stats(self) -> dict:
        """Get collection statistics."""
        return {
            "count": self.collection.count(),
            "provider": self.provider,
            "model": self.model_name,
        }
