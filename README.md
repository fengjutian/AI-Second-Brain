# Rainstone

Everything you know, AI also knows. Everything AI knows, can help you work.

## 快速开始

### 环境要求

- **Node.js** ≥ 18 + **pnpm**
- **Python** ≥ 3.10
- **Rust** (仅 Tauri 桌面端需要)

### 1. 安装前端依赖

```bash
pnpm install
```

### 2. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 3. 启动后端

```bash
cd backend
uvicorn main:app --reload --port 8710
```

后端运行在 `http://localhost:8710`，API 文档自动生成在 `/docs`。

### 4. 启动前端（浏览器模式）

```bash
pnpm dev
```

浏览器访问 `http://localhost:1420`。

### 5. 启动桌面端（Tauri）

```bash
pnpm tauri dev
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri |
| 前端 | React + TypeScript + Zustand + Tailwind CSS + TipTap + Cytoscape.js |
| 后端 | FastAPI + Uvicorn |
| AI / RAG | LlamaIndex + ChromaDB + Sentence-Transformers |
| 数据库 | SQLite FTS5 |
