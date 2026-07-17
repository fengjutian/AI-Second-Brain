"""RAG Engine — Retrieval-Augmented Generation."""
import os
from typing import AsyncGenerator, Optional
from core.embeddings import EmbeddingEngine

# Try OpenAI for chat
try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


class RAGEngine:
    """Simple RAG: retrieve from ChromaDB, generate with LLM."""

    def __init__(
        self,
        embeddings_engine: EmbeddingEngine,
        llm_provider: str = "local",    # "local" (Ollama) | "openai" | "deepseek"
        llm_model: str = None,
        base_url: str = None,           # override Ollama/DeepSeek endpoint
        api_key: str = None,            # API key for OpenAI / DeepSeek
    ):
        self.embeddings = embeddings_engine
        self.llm_provider = llm_provider
        self.llm_model = llm_model or self._default_llm()
        self._base_url = base_url
        self._api_key = api_key
        self._llm_client = None

    def _default_llm(self) -> str:
        if self.llm_provider == "local":
            return "qwen2.5:7b"  # Ollama default
        if self.llm_provider == "deepseek":
            return "deepseek-chat"
        return "gpt-4o-mini"

    def _get_llm_client(self):
        if self._llm_client:
            return self._llm_client

        if self.llm_provider == "openai":
            if not HAS_OPENAI:
                raise RuntimeError("openai not installed")
            self._llm_client = AsyncOpenAI(api_key=self._api_key or os.environ.get("OPENAI_API_KEY"))
        elif self.llm_provider == "deepseek":
            if not HAS_OPENAI:
                raise RuntimeError("openai not installed (needed for DeepSeek client)")
            url = self._base_url or os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
            key = self._api_key or os.environ.get("DEEPSEEK_API_KEY", "")
            if not key:
                raise RuntimeError("DeepSeek API key not configured")
            self._llm_client = AsyncOpenAI(
                base_url=url,
                api_key=key,
            )
        elif self.llm_provider == "local":
            # Ollama — use OpenAI-compatible endpoint
            if not HAS_OPENAI:
                raise RuntimeError("openai not installed (needed for Ollama client)")
            url = self._base_url or os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
            self._llm_client = AsyncOpenAI(
                base_url=url,
                api_key="ollama",  # Ollama doesn't require a real key
            )
        else:
            raise ValueError(f"Unknown LLM provider: {self.llm_provider}")

        return self._llm_client

    def retrieve(self, query: str, top_k: int = 5) -> list[dict]:
        """Retrieve relevant notes for a query."""
        return self.embeddings.semantic_search(query, limit=top_k)

    def build_prompt(self, query: str, context_docs: list[dict]) -> str:
        """Build a RAG prompt with retrieved context."""
        context_text = "\n\n---\n\n".join([
            f"【{doc['title']}】\n{doc['snippet']}"
            for doc in context_docs
        ])

        return f"""你是一个个人知识库助手。根据以下笔记内容回答用户问题。
如果笔记中没有相关信息，请如实告知，不要编造。

## 相关笔记

{context_text}

## 用户问题

{query}

## 回答

请基于以上笔记内容回答，引用笔记标题。"""

    async def query(self, question: str, top_k: int = 5) -> dict:
        """RAG query: retrieve + generate. Returns answer + sources."""
        # Retrieve
        docs = self.retrieve(question, top_k)

        if not docs:
            return {
                "answer": "知识库中暂无相关信息。",
                "sources": [],
            }

        # Generate
        prompt = self.build_prompt(question, docs)

        try:
            client = self._get_llm_client()
            response = await client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1024,
            )
            answer = response.choices[0].message.content or ""
        except Exception as e:
            answer = f"AI 服务暂时不可用：{str(e)}"

        sources = [
            {"note_id": d["note_id"], "title": d["title"], "score": d["score"]}
            for d in docs
        ]

        return {"answer": answer, "sources": sources}

    async def query_stream(self, question: str, top_k: int = 5) -> AsyncGenerator[str, None]:
        """Streaming RAG query — yields answer chunks."""
        docs = self.retrieve(question, top_k)

        if not docs:
            yield "知识库中暂无相关信息。"
            return

        prompt = self.build_prompt(question, docs)

        try:
            client = self._get_llm_client()
            stream = await client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1024,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content
        except Exception as e:
            yield f"\n\n[AI 服务错误：{str(e)}]"

    async def suggest_tags(self, content: str) -> list[str]:
        """Use LLM to suggest tags for note content."""
        prompt = f"""为以下笔记内容建议 3-5 个标签。仅返回标签列表，用逗号分隔，不要其他文字。
标签应简洁（1-3 个词），使用中文或英文。

笔记内容：
{content[:2000]}

标签："""

        try:
            client = self._get_llm_client()
            response = await client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=100,
            )
            text = response.choices[0].message.content or ""
            tags = [t.strip() for t in text.replace("\n", ",").split(",") if t.strip()]
            return tags[:5]
        except Exception:
            return []

    async def summarize(self, content: str) -> str:
        """Summarize note content."""
        prompt = f"""用 2-3 句话总结以下笔记内容。使用中文。

笔记内容：
{content[:4000]}

总结："""

        try:
            client = self._get_llm_client()
            response = await client.chat.completions.create(
                model=self.llm_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=300,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"[总结失败：{str(e)}]"

    async def suggest_links(self, note_id: str, content: str) -> list[dict]:
        """Suggest notes that might be related but not yet linked."""
        # Search semantically for related notes
        docs = self.embeddings.semantic_search(content, limit=5)
        # Filter out self
        return [d for d in docs if d["note_id"] != note_id]
