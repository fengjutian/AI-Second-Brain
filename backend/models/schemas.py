from pydantic import BaseModel
from datetime import datetime


class NoteResponse(BaseModel):
    id: str
    path: str
    title: str
    content: str
    tags: list[str] = []
    aliases: list[str] = []
    created: datetime
    updated: datetime
    word_count: int = 0


class NoteCreate(BaseModel):
    path: str
    template: str | None = None


class NoteUpdate(BaseModel):
    content: str


class NotePathUpdate(BaseModel):
    new_path: str


class SearchResult(BaseModel):
    note_id: str
    path: str
    title: str
    snippet: str
    score: float


class GraphNode(BaseModel):
    id: str
    label: str
    path: str
    degree: int = 0


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str | None = None


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict] = []
