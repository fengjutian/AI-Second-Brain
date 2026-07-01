# Rainstone

> Everything you know, AI also knows. Everything AI knows, can help you work.

Rainstone 是一个本地优先的个人知识管理（PKM）应用，结合了 **本地文件存储**、**知识图谱可视化**、**RAG AI 对话**、**画板白板** 和 **插件系统**。

---

## 功能特性

### 📝 笔记编辑
- **Markdown 编辑器** — 基于 TipTap，支持富文本编辑、实时保存
- **Wiki 链接** — `[[笔记名]]` 自动补全 + 悬停预览
- **标签系统** — YAML frontmatter 标签 + 行内 `#标签`
- **元数据面板** — 笔记 ID、路径、创建/更新时间
- **实时字数统计** — 状态栏显示字数/字符数

### 🔗 知识关联
- **知识图谱** — Cytoscape.js 力导向图，点击节点打开笔记
- **反向链接** — 右侧面板显示「哪些笔记引用了当前笔记」
- **出链面板** — 显示当前笔记引用了哪些笔记
- **图谱缩放控制** — 放大/缩小/全览按钮

### 📅 日历视图
- **月视图日历** — 侧边栏日历面板
- **按创建日期浏览** — 点击日期查看当天创建的文件
- **日期标记** — 有文件的日期显示圆点指示器

### 🤖 AI 对话
- **RAG 知识库问答** — 基于笔记内容回答，支持流式 SSE 响应
- **ChatPanel** — 右侧 AI 对话面板
- **多模型支持** — 本地 Ollama / OpenAI 可切换
- **Embedding 向量搜索** — Sentence-Transformers 或 OpenAI Embedding

### 🎨 白板
- **Excalidraw 手绘** — 集成 Excalidraw 画板
- **Tldraw 白板** — 结构化画图工具

### 🔌 插件系统
- **内置插件** — 每日回顾、字数统计、Markdown 格式化
- **社区插件** — 支持 `vault/plugins/` 目录加载
- **命令面板** — `Ctrl+P` 打开，搜索插件命令

### 🗂️ 文件管理
- **文件树** — 按目录浏览 .md 文件
- **标签浏览** — 按标签聚合笔记
- **搜索** — FTS5 全文搜索
- **最近知识库** — 快速切换 vault

---

## 技术架构

```
┌──────────────────────────────────────────────┐
│                 Tauri Desktop                 │
│  ┌──────────┐  ┌─────────────┐               │
│  │  React   │  │ Python API  │               │
│  │  Frontend│  │  :8710      │               │
│  └────┬─────┘  └──────┬──────┘               │
│       │               │                       │
│  ┌────┴──────┐  ┌─────┴───────┐              │
│  │ Tauri FS  │  │ SQLite FTS5 │              │
│  │ (本地读写)│  │ + ChromaDB  │              │
│  └───────────┘  └─────────────┘              │
└──────────────────────────────────────────────┘
```

### 前端

| 技术 | 用途 |
|------|------|
| React 19 + TypeScript 5.7 | UI 框架 |
| Zustand 5 | 状态管理 (notes/tabs/plugins/settings) |
| Tailwind CSS 3.4 | 样式 |
| TipTap 3 | 富文本编辑器 |
| Cytoscape.js 3.30 | 知识图谱 |
| Excalidraw / Tldraw | 画板 |
| React Router 7 | 路由 |
| Radix UI | 无障碍基础组件 |

### 后端

| 技术 | 用途 |
|------|------|
| FastAPI + Uvicorn | REST API + WebSocket |
| SQLite FTS5 | 全文搜索 |
| ChromaDB | 向量数据库 |
| LlamaIndex | RAG 管道 |
| Sentence-Transformers | 本地 Embedding |
| Watchdog | 文件变化监听 |

### 桌面框架

| 技术 | 用途 |
|------|------|
| Tauri 2 | 桌面容器 |
| Rust | 原生层 |
| Tauri FS Plugin | 本地文件读写 |
| Tauri SQL Plugin | 本地 SQLite |
| Tauri Dialog Plugin | 文件夹选择 |

---

## 项目结构

```
rainstone/
├── src/                        # React 前端
│   ├── App.tsx                 # 根组件 & 路由
│   ├── main.tsx                # 入口
│   ├── index.css               # Tailwind 全局样式
│   ├── components/
│   │   ├── MainLayout.tsx      # 主布局 (ActivityBar + Sidebar + Editor)
│   │   ├── CommandPalette.tsx  # Ctrl+P 命令面板
│   │   ├── StatusBar.tsx       # 底部状态栏
│   │   ├── ErrorBoundary.tsx   # 全局错误边界
│   │   ├── editor/
│   │   │   ├── Editor.tsx      # TipTap 编辑器
│   │   │   ├── WikiLink.tsx    # [[wiki链接]] 自动补全
│   │   │   ├── HoverPreview.tsx# 悬停笔记预览
│   │   │   └── SlashMenu.tsx   # / 命令菜单
│   │   ├── sidebar/
│   │   │   ├── ActivityBar.tsx # 左侧图标导航栏
│   │   │   ├── Sidebar.tsx     # 左侧面板容器
│   │   │   ├── FileTree.tsx    # 文件树
│   │   │   ├── CalendarPanel.tsx # 日历面板
│   │   │   ├── GraphCore.tsx   # 图谱共享组件
│   │   │   ├── GraphPanel.tsx  # 侧边栏图谱
│   │   │   └── RightSidebar.tsx# 右侧面板 (出链/反链/AI)
│   │   ├── chat/
│   │   │   └── ChatPanel.tsx   # AI 对话面板
│   │   ├── search/
│   │   │   └── SearchPanel.tsx # 搜索面板
│   │   ├── tabs/
│   │   │   └── TabManager.tsx  # 标签页管理
│   │   └── ui/                 # 通用 UI 组件
│   ├── pages/
│   │   ├── settings/           # 设置页各 Tab
│   │   │   ├── GeneralSection.tsx
│   │   │   ├── AiSection.tsx
│   │   │   ├── PluginSection.tsx
│   │   │   └── ImportSection.tsx
│   │   ├── SettingsPage.tsx    # 设置页容器
│   │   ├── GraphView.tsx       # 全屏图谱页
│   │   └── WhiteboardPage.tsx  # 白板页
│   ├── stores/                 # Zustand 状态
│   │   ├── noteStore.ts        # 笔记缓存 + 脏状态
│   │   ├── tabStore.ts         # 标签页管理
│   │   ├── settingsStore.ts    # 主题/知识库/AI配置
│   │   └── pluginStore.ts      # 插件注册/启停
│   ├── plugins/                # 核心插件
│   │   ├── daily-review.ts     # 每日随机回顾
│   │   ├── word-count.ts       # 字数统计
│   │   └── markdown-format.ts  # 格式化命令
│   ├── lib/
│   │   ├── api.ts              # HTTP API 客户端
│   │   ├── localIndex.ts       # Tauri 本地 SQLite FTS
│   │   ├── plugin-api.ts       # 插件接口定义
│   │   ├── env.ts              # 环境检测
│   │   └── utils.ts            # 工具函数 + HTML→Markdown
│   └── hooks/                  # 自定义 Hooks
├── backend/                    # Python 后端
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # AI 配置
│   ├── session.py              # 会话持久化
│   ├── shared.py               # 全局单例
│   ├── api/
│   │   ├── notes.py            # 笔记 CRUD
│   │   ├── search.py           # FTS5 搜索
│   │   ├── chat.py             # AI 对话 (SSE)
│   │   ├── graph.py            # 图谱数据
│   │   ├── daily.py            # 日记
│   │   ├── calendar.py         # 日历分组
│   │   └── import_api.py       # Obsidian 导入
│   ├── core/
│   │   ├── indexer.py          # Markdown 解析 + SQLite 同步
│   │   ├── embeddings.py       # 向量嵌入
│   │   ├── rag.py              # RAG 管道
│   │   ├── watcher.py          # 文件监听
│   │   └── plugin_system.py    # 后端插件
│   ├── models/
│   │   └── schemas.py          # Pydantic 模型
│   └── data/
│       └── database.py         # SQLite 初始化
├── src-tauri/                  # Tauri 桌面容器 (Rust)
├── package.json
└── vite.config.ts
```

---

## 快速开始

### 环境要求

- **Node.js** ≥ 18 + **pnpm**
- **Python** ≥ 3.10
- **Rust** (仅 Tauri 桌面端)

### 1. 安装依赖

```bash
# 前端
pnpm install

# 后端
cd backend
pip install -r requirements.txt
```

### 2. 启动后端

```bash
cd backend
uvicorn main:app --reload --port 8710
```

API 运行在 `http://localhost:8710`，交互文档在 `http://localhost:8710/docs`。

### 3. 启动前端

```bash
# 浏览器模式
pnpm dev          # → http://localhost:1420

# Tauri 桌面端
pnpm tauri dev    # → 原生桌面窗口
```

### 4. 使用

1. 打开应用 → 选择一个 Markdown 文件夹作为知识库
2. 左侧文件树浏览笔记，点击打开编辑
3. `Ctrl+P` 打开命令面板
4. 点击图谱图标查看知识关系网络
5. 右侧 AI 面板可以基于笔记内容提问

---

## AI 配置

在 「设置 → AI 设置」中配置：

| 模型 | 提供者 | 默认值 |
|------|--------|--------|
| Embedding | local / OpenAI | `all-MiniLM-L6-v2` |
| LLM | Ollama / OpenAI | `qwen2.5:7b` |
| Ollama URL | 本地地址 | `http://localhost:11434/v1` |

---

## 双模式运行

Rainstone 支持两种模式：

| 模式 | 说明 |
|------|------|
| **浏览器模式** | React + Python 后端，适合开发和调试 |
| **Tauri 桌面模式** | 原生桌面应用，本地 SQLite + 文件系统直读直写 |

在 Tauri 模式下，即使后端未运行，基础功能（文件浏览、编辑、保存）仍可正常使用。AI 对话和向量搜索需要后端。

---

## 插件开发

```typescript
// vault/plugins/my-plugin/index.ts
export const MyPlugin: Plugin = {
  manifest: {
    id: "my-plugin",
    name: "我的插件",
    version: "1.0.0",
    description: "描述",
    author: "你的名字",
    minAppVersion: "0.3.0",
  },
  activate(context: PluginContext) {
    context.addCommand({
      id: "hello",
      name: "打个招呼",
      callback: () => alert("Hello!"),
    });
  },
  deactivate() {},
};
```

---

## License

MIT
