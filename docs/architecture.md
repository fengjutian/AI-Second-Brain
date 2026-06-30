# AI 第二大脑 — 架构设计文档

> 基于需求 v1.0，技术栈：Tauri + React + FastAPI

---

## 1. 架构总览

### 1.1 进程模型

```
┌─────────────────────────────────────────────────┐
│                 Tauri Shell (Rust)               │
│                                                 │
│  ┌──────────────────┐  ┌─────────────────────┐  │
│  │  React Frontend   │  │  FastAPI Backend    │  │
│  │  (WebView)        │  │  (Sidecar Process)  │  │
│  │                   │  │                     │  │
│  │  localhost:1420   │  │  localhost:8710     │  │
│  │       │           │  │       │             │  │
│  │       └──HTTP/WS──┼──┼───────┘             │  │
│  └──────────────────┘  └──────────┬──────────┘  │
│                                   │              │
│                          ┌────────▼──────────┐  │
│                          │   Local Storage    │  │
│                          │  vault/*.md        │  │
│                          │  data/app.db       │  │
│                          │  data/chroma/      │  │
│                          └───────────────────┘  │
└─────────────────────────────────────────────────┘
```

- **Tauri Shell**：窗口管理、系统托盘、菜单、自动更新
- **React Frontend (WebView)**：UI 渲染，端口 `1420`
- **FastAPI Backend (Sidecar)**：业务逻辑、AI、搜索，端口 `8710`
- 开发时前后端各自独立启动；生产时 Tauri 自动拉起 FastAPI sidecar

### 1.2 数据流

```
用户操作 → React → HTTP/WS → FastAPI → 文件系统 / SQLite / ChromaDB
                                    │
                                    ▼
                              索引更新（FTS5 + Vector）
                                    │
                                    ▼
                         WebSocket 推送 → React 刷新 UI
```

两条关键数据流：

**笔记编辑流（同步）**
```
TipTap 编辑 → Zustand 本地状态 → 自动保存 → PUT /api/notes/{id} → 写入 .md 文件
                                                                    → 更新 FTS5 索引
                                                                    → 更新 ChromaDB 向量
                                                                    → WebSocket broadcast
```

**AI 问答流（异步）**
```
用户提问 → POST /api/chat → LlamaIndex 检索 ChromaDB → 构建 prompt → LLM 生成
                                                                    → 流式返回 SSE
```

### 1.3 模块划分

```
后端 FastAPI                    前端 React
────────────────────────────    ────────────────────────────
api/                            src/
├─ notes.py     笔记 CRUD       ├─ components/
├─ search.py    搜索 API        │  ├─ editor/      TipTap 封装
├─ chat.py      AI 对话         │  ├─ graph/       Cytoscape.js 图谱
├─ graph.py     图谱数据         │  ├─ sidebar/    文件浏览器/反链
├─ tags.py      标签管理         │  ├─ tabs/       多标签页管理
├─ vault.py     仓库管理         │  ├─ search/     搜索面板
├─ ws.py        WebSocket       │  └─ chat/       AI 对话面板
│                               ├─ stores/        Zustand stores
core/                           │  ├─ noteStore.ts
├─ indexer.py   索引引擎         │  ├─ tabStore.ts
├─ watcher.py   文件监听         │  ├─ graphStore.ts
├─ embeddings.py 向量嵌入        │  ├─ searchStore.ts
└─ rag.py       RAG 引擎         │  └─ settingsStore.ts
│                               ├─ hooks/         自定义 hooks
models/                         ├─ lib/           API client
├─ note.py      数据模型         └─ pages/        路由页面
├─ schemas.py   Pydantic
│
data/
├─ database.py  SQLite 管理
└─ chroma.py    ChromaDB 管理
```

### 1.4 项目目录结构

```
ai-second-brain/
├─ src-tauri/               # Tauri Rust 壳
│   ├─ src/main.rs
│   ├─ tauri.conf.json
│   └─ icons/
│
├─ src/                     # React 前端
│   ├─ components/
│   ├─ stores/
│   ├─ hooks/
│   ├─ lib/
│   ├─ pages/
│   ├─ App.tsx
│   ├─ main.tsx
│   └─ index.css            # Tailwind 入口
│
├─ backend/                 # FastAPI 后端
│   ├─ api/
│   ├─ core/
│   ├─ models/
│   ├─ data/
│   ├─ main.py
│   └─ requirements.txt
│
├─ package.json
├─ tailwind.config.ts
├─ tsconfig.json
├─ vite.config.ts
└─ docs/
    ├─ requirements.md
    └─ architecture.md
```

---

## 2. 数据模型设计

### 2.1 文件系统（源数据）

```
vault/                        # 知识库根目录
├─ note-one.md
├─ note-two.md
├─ daily/                     # 日记子目录
│   └─ 2026-06-30.md
├─ attachments/               # 附件统一存放
│   ├─ img-001.png
│   └─ doc-002.pdf
└─ templates/                 # 笔记模板
    └─ meeting.md
```

### 2.2 Markdown Frontmatter（笔记元数据）

```yaml
---
id: a1b2c3d4                    # UUID，自动生成
title: "我的笔记"
tags: [tag1, tag2]
created: 2026-06-30T10:00:00Z
updated: 2026-06-30T12:00:00Z
aliases: [别名1, 别名2]
pinned: false
---
正文内容...
```

### 2.3 链接模型

```
[[目标笔记名]]
[[目标笔记名|显示文本]]
[[目标笔记名#章节标题]]
```

解析规则：
- 提取 `[[...]]` 中的所有链接目标
- 匹配目标笔记名 → 解析为 `note_id`
- 匹配 `#heading` → 解析为 `note_id + anchor`
- 未匹配 → 标记为待创建链接

### 2.4 SQLite 表结构

```sql
-- 笔记索引表（镜像文件系统）
CREATE TABLE notes (
    id          TEXT PRIMARY KEY,          -- UUID
    path        TEXT NOT NULL UNIQUE,       -- 相对路径 "note-one.md"
    title       TEXT NOT NULL,              -- 标题
    aliases     TEXT,                        -- JSON 数组 '["a1","a2"]'
    tags        TEXT,                        -- JSON 数组 '["tag1","tag2"]'
    created     TEXT NOT NULL,              -- ISO 8601
    updated     TEXT NOT NULL,
    pinned      INTEGER DEFAULT 0,
    word_count  INTEGER DEFAULT 0,
    checksum    TEXT                         -- 文件内容 hash，用于变更检测
);

-- 全文搜索虚拟表
CREATE VIRTUAL TABLE notes_fts USING fts5(
    title,
    content,
    content_rowid='rowid'
);

-- 链接关系表
CREATE TABLE links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id   TEXT NOT NULL,              -- 源笔记 UUID
    target_id   TEXT,                       -- 目标笔记 UUID（NULL = 待创建）
    target_text TEXT NOT NULL,              -- [[...]] 中的原始文本
    anchor      TEXT,                       -- 章节锚点（可选）
    FOREIGN KEY (source_id) REFERENCES notes(id),
    FOREIGN KEY (target_id) REFERENCES notes(id)
);

-- 标签表（辅助查询）
CREATE TABLE tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    note_count  INTEGER DEFAULT 0
);

-- 索引
CREATE INDEX idx_notes_tags ON notes(tags);
CREATE INDEX idx_notes_updated ON notes(updated DESC);
CREATE INDEX idx_links_source ON links(source_id);
CREATE INDEX idx_links_target ON links(target_id);
```

### 2.5 ChromaDB 向量集合

```python
# 集合名: "notes"
{
    "id": "note-uuid",
    "document": "标题\n\n正文内容...",       # 检索用文本
    "metadata": {
        "title": "笔记标题",
        "path": "note-one.md",
        "tags": "tag1,tag2",
        "updated": "2026-06-30T12:00:00Z"
    },
    "embedding": [0.012, -0.034, ...]       # 768-dim 向量
}
```

---

## 3. API 设计

### 3.1 REST API

Base URL: `http://localhost:8710/api/v1`

| Method | Path | 说明 | 请求体 | 响应 |
|--------|------|------|--------|------|
| **仓库** |
| `GET` | `/vaults` | 列出仓库 | — | `Vault[]` |
| `POST` | `/vaults` | 创建/打开仓库 | `{path}` | `Vault` |
| `GET` | `/vaults/{id}/stats` | 仓库统计 | — | `Stats` |
| **笔记** |
| `GET` | `/notes` | 笔记列表 | `?path&tag&sort&limit&offset` | `Note[]` |
| `GET` | `/notes/{id}` | 获取笔记 | — | `Note` |
| `POST` | `/notes` | 创建笔记 | `{path,template?}` | `Note` |
| `PUT` | `/notes/{id}` | 更新笔记 | `{content}` | `Note` |
| `DELETE` | `/notes/{id}` | 删除（回收站） | — | `204` |
| `PATCH` | `/notes/{id}/rename` | 重命名/移动 | `{new_path}` | `Note` |
| `PATCH` | `/notes/{id}/frontmatter` | 更新元数据 | `{tags?,aliases?,pinned?}` | `Note` |
| **链接** |
| `GET` | `/notes/{id}/links/outgoing` | 出链列表 | — | `Link[]` |
| `GET` | `/notes/{id}/links/backlinks` | 反链列表 | — | `Link[]` |
| `GET` | `/notes/{id}/links/unlinked` | 未链接提及 | — | `Link[]` |
| **搜索** |
| `GET` | `/search` | 关键词搜索 | `?q&tag&limit` | `SearchResult[]` |
| `GET` | `/search/semantic` | 语义搜索 | `?q&limit` | `SearchResult[]` |
| **图谱** |
| `GET` | `/graph` | 全局图谱 | `?limit` | `GraphData` |
| `GET` | `/graph/{id}/local` | 局部图谱 | `?depth` | `GraphData` |
| **标签** |
| `GET` | `/tags` | 所有标签 | — | `Tag[]` |
| **AI** |
| `POST` | `/chat` | AI 对话 | `{messages[],stream?}` | `ChatResponse` |
| `POST` | `/chat/stream` | 流式对话 | `{messages[]}` | `SSE Stream` |
| `POST` | `/ai/suggest-tags` | 建议标签 | `{content}` | `{tags[]}` |
| `POST` | `/ai/summarize` | 生成摘要 | `{content}` | `{summary}` |
| `POST` | `/ai/suggest-links` | 发现关联 | `{note_id}` | `{related[]}` |
| **附件** |
| `POST` | `/attachments` | 上传附件 | `multipart` | `Attachment` |
| `GET` | `/attachments/{id}` | 获取附件 | — | binary |

### 3.2 WebSocket

Endpoint: `ws://localhost:8710/ws`

```
客户端 → 服务端:
  { "type": "subscribe", "channel": "notes" }
  { "type": "subscribe", "channel": "vault" }

服务端 → 客户端:
  { "type": "note_updated",   "data": { "id": "...", "path": "..." } }
  { "type": "note_created",   "data": { "id": "...", "path": "..." } }
  { "type": "note_deleted",   "data": { "id": "...", "path": "..." } }
  { "type": "file_changed",   "data": { "path": "...", "source": "external" } }
  { "type": "index_progress", "data": { "current": 42, "total": 100 } }
```

### 3.3 Pydantic Schema 示例

```python
class NoteResponse(BaseModel):
    id: str
    path: str
    title: str
    content: str
    frontmatter: dict
    tags: list[str]
    aliases: list[str]
    created: datetime
    updated: datetime
    word_count: int

class SearchResult(BaseModel):
    note_id: str
    path: str
    title: str
    snippet: str            # 关键词高亮片段
    score: float            # 0-1 相关度

class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]

class GraphNode(BaseModel):
    id: str
    label: str
    path: str
    degree: int             # 连接数
    weight: int             # 节点大小权重

class GraphEdge(BaseModel):
    source: str
    target: str
    label: Optional[str]
```

---

## 4. 前端组件设计

### 4.1 页面布局

```
┌─────────────────────────────────────────────────┐
│  Title Bar (Tauri 原生 / 自定义)                   │
├──────────┬──────────────────┬───────────────────┤
│ Sidebar  │   Tab Bar                        [-] │
│          ├──────────────────┼───────────────────┤
│ ┌──────┐ │                  │  Right Sidebar    │
│ │Search│ │   Editor Area    │  ┌─────────────┐  │
│ └──────┘ │   (TipTap)       │  │ Outgoing    │  │
│ ┌──────┐ │                  │  │ Links       │  │
│ │Files │ │                  │  ├─────────────┤  │
│ │      │ │                  │  │ Backlinks   │  │
│ │      │ │                  │  ├─────────────┤  │
│ └──────┘ │                  │  │ Tags        │  │
│ ┌──────┐ │                  │  └─────────────┘  │
│ │Tags  │ │                  │                   │
│ └──────┘ │                  │                   │
├──────────┴──────────────────┴───────────────────┤
│  Status Bar (word count, save status, AI status) │
└─────────────────────────────────────────────────┘
```

### 4.2 核心组件树

```
App
├─ TitleBar
├─ MainLayout
│   ├─ Sidebar
│   │   ├─ SearchBar
│   │   ├─ QuickActions (新建/日记/图谱)
│   │   ├─ FileTree               # 文件浏览器
│   │   │   └─ FileTreeNode[]
│   │   ├─ TagList
│   │   └─ BookmarkList
│   │
│   ├─ TabManager
│   │   ├─ TabBar
│   │   │   └─ Tab[]
│   │   └─ TabPanel
│   │       └─ Editor              # TipTap 封装
│   │           ├─ EditorToolbar
│   │           └─ EditorContent
│   │
│   ├─ RightSidebar (可折叠)
│   │   ├─ OutgoingLinks
│   │   ├─ Backlinks
│   │   ├─ TagPanel
│   │   └─ AIChatPanel            # 内嵌 AI 对话
│   │
│   ├─ SearchPanel (弹出层)
│   │   ├─ FullTextSearch
│   │   └─ SemanticSearch
│   │
│   ├─ GraphView (独立页面)
│   │   ├─ GraphCanvas (Cytoscape)
│   │   ├─ GraphControls (缩放/筛选/布局)
│   │   └─ GraphDetail (点击节点详情)
│   │
│   └─ CommandPalette (Ctrl+P)
│
├─ SettingsPage
└─ StatusBar
```

### 4.3 Zustand Store 设计

```typescript
// noteStore.ts
interface NoteStore {
  notes: Map<string, Note>;
  currentId: string | null;
  isDirty: boolean;
  
  loadNote: (id: string) => Promise<void>;
  saveNote: (id: string) => Promise<void>;
  createNote: (path: string) => Promise<string>;
  deleteNote: (id: string) => Promise<void>;
  updateFrontmatter: (id: string, fm: Partial<Frontmatter>) => Promise<void>;
}

// tabStore.ts
interface TabStore {
  tabs: Tab[];                    // { id, noteId, isPinned, scrollPosition }
  activeTabId: string | null;
  
  openTab: (noteId: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (from: number, to: number) => void;
}

// graphStore.ts
interface GraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: 'cose' | 'breadthfirst' | 'concentric';
  selectedNode: string | null;
  
  loadGraph: (scope?: { noteId: string; depth: number }) => Promise<void>;
  setLayout: (layout: string) => void;
}

// searchStore.ts
interface SearchStore {
  query: string;
  results: SearchResult[];
  mode: 'keyword' | 'semantic';
  isSearching: boolean;
  
  search: (q: string) => Promise<void>;
  clearSearch: () => void;
}

// settingsStore.ts
interface SettingsStore {
  theme: 'light' | 'dark' | 'system';
  language: 'zh' | 'en';
  vaultPath: string | null;
  aiProvider: 'local' | 'openai';
  aiModel: string;
  
  updateSettings: (partial: Partial<Settings>) => void;
}
```

### 4.4 状态流向

```
用户输入 → TipTap onUpdate
         → noteStore.setDirty(true)
         → debounce 1s
         → noteStore.saveNote()
         → POST /api/notes/{id}
         → 后端更新 .md + 索引
         → WebSocket 广播
         → 其他客户端/窗口 → noteStore 刷新对应笔记

链接点击 → tabStore.openTab(noteId)
         → noteStore.loadNote(noteId)
         → GET /api/notes/{id}
         → 渲染到新的 Tab Panel

图谱交互 → graphStore.setSelectedNode(id)
         → graphStore.loadGraph({noteId: id, depth: 1})
         → Cytoscape 局部刷新
```

---

## 5. 开发环境搭建指南

### 5.1 前置依赖

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 20 | 前端构建 |
| pnpm | ≥ 9 | 包管理器 |
| Rust | ≥ 1.75 | Tauri 编译 |
| Python | ≥ 3.11 | 后端运行 |
| uv / pip | 最新 | Python 包管理 |

### 5.2 初始搭建

```bash
# 1. 克隆项目
git clone <repo-url>
cd ai-second-brain

# 2. 安装前端依赖
pnpm install

# 3. 安装后端依赖
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..

# 4. 安装 Tauri CLI
cargo install tauri-cli
```

### 5.3 日常开发启动

```bash
# 终端 1：启动 FastAPI（开发模式，热重载）
cd backend
uvicorn main:app --reload --port 8710

# 终端 2：启动 React 前端（开发模式，热重载）
pnpm dev

# 需要 Tauri 壳时（调试系统功能）：
pnpm tauri dev
```

### 5.4 调试

| 目标 | 方式 |
|------|------|
| React 前端 | 浏览器 DevTools (`http://localhost:1420`)，React DevTools 扩展 |
| FastAPI 后端 | Swagger UI (`http://localhost:8710/docs`)，`logging` 模块 |
| Tauri 壳 | `pnpm tauri dev` 自带 Rust panic 输出，WebView console 映射到终端 |
| WebSocket | Postman / `wscat -c ws://localhost:8710/ws` |
| SQLite | `sqlite3 data/app.db` 或 DB Browser for SQLite |

### 5.5 关键配置文件

```toml
# src-tauri/tauri.conf.json (关键字段)
{
  "productName": "AI Second Brain",
  "identifier": "com.ai-second-brain.app",
  "build": {
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "bundle": {
    "externalBin": ["backend/fastapi-server"]  // sidecar binary
  }
}
```

```python
# backend/main.py 骨架
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import notes, search, chat, graph, tags, vault, ws

app = FastAPI(title="AI Second Brain", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "tauri://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router,    prefix="/api/v1")
app.include_router(search.router,   prefix="/api/v1")
app.include_router(chat.router,     prefix="/api/v1")
app.include_router(graph.router,    prefix="/api/v1")
app.include_router(tags.router,     prefix="/api/v1")
app.include_router(vault.router,    prefix="/api/v1")

@app.on_event("startup")
async def startup():
    # 初始化 SQLite + ChromaDB
    # 启动 watchdog 文件监听
    pass

@app.on_event("shutdown")
async def shutdown():
    # 清理资源
    pass
```

```typescript
// src/lib/api.ts (API client)
const BASE = 'http://localhost:8710/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export const api = {
  notes: {
    list:   (params?: any) => request<Note[]>(`/notes?${new URLSearchParams(params)}`),
    get:    (id: string)   => request<Note>(`/notes/${id}`),
    create: (body: any)    => request<Note>('/notes', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<Note>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string)   => request<void>(`/notes/${id}`, { method: 'DELETE' }),
  },
  search: {
    keyword:  (q: string) => request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
    semantic: (q: string) => request<SearchResult[]>(`/search/semantic?q=${encodeURIComponent(q)}`),
  },
  chat: {
    send: (messages: Message[]) => request<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
  },
  graph: {
    global: () => request<GraphData>('/graph'),
    local: (id: string, depth = 1) => request<GraphData>(`/graph/${id}/local?depth=${depth}`),
  },
};
```

---

## 6. 关键流程时序图

### 6.1 笔记保存流程

```
用户        TipTap      Zustand       API Client    FastAPI     Filesystem   SQLite/Chroma
 │            │            │              │            │            │            │
 │ 输入文字   │            │              │            │            │            │
 ├───────────►            │              │            │            │            │
 │  onUpdate  │            │              │            │            │            │
 ├───────────► setDirty   │              │            │            │            │
 │            ├───────────►              │            │            │            │
 │            │            │ debounce 1s │            │            │            │
 │            │            ├─────────────►            │            │            │
 │            │            │          PUT /notes/{id} │            │            │
 │            │            │              ├───────────►            │            │
 │            │            │              │       写入 .md         │            │
 │            │            │              │           ├───────────►            │
 │            │            │              │       更新 FTS5+Chroma │            │
 │            │            │              │           ├────────────┼───────────►
 │            │            │              │◄────── OK ┼────────────┼────────────┤
 │            │            │◄─────────────┤           │            │            │
 │            │            │ setDirty(false)          │            │            │
 │            │◄───────────┤              │            │            │            │
 │◄───────────┤            │              │            │            │            │
 │            │            │              │            │     WebSocket broadcast │
 │            │            │◄─────────────┼────────────┼────────────┼────────────┤
```

### 6.2 AI 问答流程

```
用户        ChatPanel    API Client    FastAPI      LlamaIndex   ChromaDB     LLM
 │            │            │            │            │            │          │
 │ 提问       │            │            │            │            │          │
 ├───────────►            │            │            │            │          │
 │            ├───────────►            │            │            │          │
 │            │     POST /chat         │            │            │          │
 │            │            ├───────────►            │            │          │
 │            │            │      embed(question)   │            │          │
 │            │            │            ├───────────►            │          │
 │            │            │            │       query(embedding) │          │
 │            │            │            │            ├───────────►          │
 │            │            │            │            │◄─ top-k docs ────────┤
 │            │            │            │◄───────────┤            │          │
 │            │            │            │  构建 prompt│            │          │
 │            │            │            ├────────────┼────────────┼─────────►
 │            │            │            │◄───────────┼────────────┼──────────┤
 │            │            │◄─ SSE ─────┤            │            │          │
 │            │◄─ 流式渲染 ─┤            │            │            │          │
 │◄───────────┤            │            │            │            │          │
```

---

> 下一步：按 MVP 版本规划开始编码实现。
