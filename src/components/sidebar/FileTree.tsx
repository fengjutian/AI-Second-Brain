import { forwardRef, useImperativeHandle, useEffect, useState, useMemo, memo, useCallback, useRef } from "react";
import { FaFile, FaFolder, FaFolderOpen, FaChevronRight, FaChevronDown, FaTrashCan } from "react-icons/fa6";
import { api } from "@/lib/api";
import { isTauri } from "@/lib/env";
import { useTabStore } from "@/stores/tabStore";
import { useNoteStore } from "@/stores/noteStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { InputDialog } from "@/components/ui/InputDialog";
import { resetWikiLinkCache } from "@/components/editor/WikiLink";
import { invalidateCalendarCache } from "@/components/sidebar/CalendarPanel";

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(notes: { path: string; title: string; id: string }[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };

  for (const note of notes) {
    const parts = note.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const name = parts[i];
      let child = current.children.find((c) => c.name === name);
      if (!child) {
        child = {
          name,
          path: parts.slice(0, i + 1).join("/"),
          isDir: !isLast,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Sort: dirs first, then files, alphabetically
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sort(n.children));
  };
  sort(root.children);
  return root.children;
}

/** Recursively scan vault directory for all files using Tauri FS plugin */
async function scanDirectory(dirPath: string, rootPath?: string): Promise<{ id: string; path: string; title: string }[]> {
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(dirPath);
  const results: { id: string; path: string; title: string }[] = [];
  const base = rootPath || dirPath;

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === ".trash") continue;

    const fullPath = `${dirPath}/${entry.name}`;
    const relPath = fullPath.slice(base.length + 1); // relative from vault root

    if (entry.isDirectory) {
      const children = await scanDirectory(fullPath, base);
      results.push(...children);
    } else {
      results.push({ id: fullPath, path: relPath, title: entry.name });
    }
  }
  return results;
}

export const FileTree = forwardRef<{ refresh: () => void }>(function FileTree(_props, ref) {
  const [notes, setNotes] = useState<{ id: string; path: string; title: string }[]>([]);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const openTab = useTabStore((s) => s.openTab);
  const loadNote = useNoteStore((s) => s.loadNote);
  const vaultPath = useSettingsStore((s) => s.vaultPath);

  useEffect(() => {
    if (isTauri()) {
      // Tauri: scan vault directory directly via Tauri FS plugin
      const load = async () => {
        try {
          const files = await scanDirectory(vaultPath);
          setNotes(files);
        } catch (e) {
          console.error("Failed to scan vault via Tauri FS:", e);
        }
      };
      load();
    } else {
      // Browser: use HTTP API
      api.notes.list().then(setNotes).catch(() => {});
    }
  }, [vaultPath]);

  // Real-time updates via WebSocket from backend file watcher (browser only)
  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    if (isTauri()) {
      scanDirectory(vaultPath).then(setNotes).catch(() => {});
    } else {
      api.notes.list().then(setNotes).catch(() => {});
    }
  };

  useImperativeHandle(ref, () => ({ refresh: refreshRef.current }), []);

  useEffect(() => {
    if (isTauri()) return; // No WebSocket in Tauri mode

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (useSettingsStore.getState().offlineMode) return;
      try {
        ws = new WebSocket("ws://localhost:8710/ws");
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type && /^note_/.test(msg.type)) {
              refreshRef.current();
            }
          } catch {}
        };
        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch {}
    };

    connect();

    // React to offline mode changes
    const unsub = useSettingsStore.subscribe(
      (state, prev) => {
        if (state.offlineMode !== prev.offlineMode) {
          if (state.offlineMode) {
            clearTimeout(reconnectTimer);
            ws?.close();
            ws = null;
          } else {
            connect();
          }
        }
      }
    );

    return () => {
      unsub();
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const tree = useMemo(() => buildTree(notes), [notes]);

  const handleOpen = useCallback(async (noteId: string, relPath: string) => {
    const title = relPath.split("/").pop() || relPath;

    // Excel / CSV / PDF / Image files — skip content loading, viewer handles it
    const isExcel = /\.(xlsx|xls|xlsm|csv|tsv)$/i.test(relPath);
    const isPdf = /\.pdf$/i.test(relPath);
    const isImage = /\.(png|jpe?g|svg|gif|webp|bmp|ico)$/i.test(relPath);
    const isBinary = isExcel || isPdf || isImage;

    if (isTauri()) {
      // Tauri: read file directly from filesystem
      // Binary files (Excel, PDF etc.) — don't try readTextFile, delegate to viewer
      if (isBinary) {
        const note = { id: noteId, path: relPath, title, content: "" };
        loadNote(noteId, note);
        openTab({ noteId, title, path: relPath });
        return;
      }

      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      let raw: string;
      try {
        raw = await readTextFile(noteId);
      } catch {
        // Binary or unreadable file — show placeholder
        const note = { id: noteId, path: relPath, title, content: `[无法预览此文件: ${title}]` };
        loadNote(noteId, note);
        openTab({ noteId, title, path: relPath });
        return;
      }

      // Strip YAML frontmatter only for .md files
      if (relPath.endsWith(".md")) {
        const normalized = raw.replace(/\r\n/g, "\n");
        if (normalized.startsWith("---\n")) {
          const end = normalized.indexOf("\n---\n", 4);
          if (end !== -1) {
            raw = normalized.slice(end + 5).trimStart();
          } else {
            raw = normalized;
          }
        }
      }

      const note = { id: noteId, path: relPath, title, content: raw };
      loadNote(noteId, note);
      openTab({ noteId, title, path: relPath });
    } else {
      // Browser: try API, fallback gracefully for non-note files
      // Binary files (Excel, PDF) — just open, viewer handles loading
      if (isBinary) {
        const note = { id: noteId, path: relPath, title, content: "" };
        loadNote(noteId, note);
        openTab({ noteId, title, path: relPath });
        return;
      }
      try {
        const note = await api.notes.get(noteId);
        loadNote(noteId, note);
        openTab({ noteId, title: note.title, path: note.path });
      } catch {
        const note = { id: noteId, path: relPath, title, content: `[无法预览此文件: ${title}]` };
        loadNote(noteId, note);
        openTab({ noteId, title, path: relPath });
      }
    }
  }, [loadNote, openTab]);

  const handleCreateNote = async (name: string) => {
    const path = `${name}.md`;

    if (isTauri()) {
      // Tauri: write .md file directly with YAML frontmatter
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const noteId = crypto.randomUUID();
      const now = new Date().toISOString();
      const frontmatter = `---\nid: ${noteId}\ntitle: ${name}\ncreated: ${now}\nupdated: ${now}\ntags: []\n---\n\n`;
      const filePath = `${vaultPath}/${path}`;
      await writeTextFile(filePath, frontmatter);
      const title = name;
      const content = "";
      setNotes((prev) => [...prev, { id: filePath, path, title }]);
      loadNote(filePath, { id: filePath, path, title, content });
      openTab({ noteId: filePath, title, path });
      resetWikiLinkCache();
      invalidateCalendarCache();
    } else {
      const note = await api.notes.create({ path });
      setNotes((prev) => [...prev, { id: note.id, path: note.path, title: note.title }]);
      loadNote(note.id, note);
      resetWikiLinkCache();
      invalidateCalendarCache();
      openTab({ noteId: note.id, title: note.title, path: note.path });
    }
  };

  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!confirm("确定删除这篇笔记？\n\n笔记会被移到 .trash 目录，可以手动恢复。")) return;
    if (isTauri()) {
      try {
        // Try API first (it handles .trash properly)
        await api.notes.delete(noteId);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        invalidateCalendarCache();
      } catch {
        // Fallback: direct delete via Tauri FS
        try {
          const { remove } = await import("@tauri-apps/plugin-fs");
          await remove(noteId);
          setNotes((prev) => prev.filter((n) => n.id !== noteId));
        } catch (e) {
          console.error("Failed to delete note:", e);
        }
      }
    } else {
      try {
        await api.notes.delete(noteId);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        invalidateCalendarCache();
      } catch (e) {
        console.error("Failed to delete note:", e);
      }
    }
  }, []);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">文件</span>
        <button
          onClick={() => setNewNoteOpen(true)}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          + 新建
        </button>
      </div>
      {tree.length === 0 ? (
        <p className="text-xs text-zinc-400 px-1 py-2">暂无文件</p>
      ) : (
        tree.map((node) => (
          <TreeNodeItem
            key={node.path}
            node={node}
            notes={notes}
            onOpen={handleOpen}
            onDelete={handleDeleteNote}
          />
        ))
      )}
      <InputDialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
        title="新建笔记"
        placeholder="笔记名（不含 .md）"
        confirmLabel="创建"
        onConfirm={handleCreateNote}
      />
    </div>
  );
});

const TreeNodeItem = memo(function TreeNodeItem({
  node,
  notes,
  onOpen,
  onDelete,
  depth = 0,
}: {
  node: TreeNode;
  notes: { id: string; path: string; title: string }[];
  onOpen: (id: string, path: string) => void;
  onDelete: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.isDir) {
    return (
      <div>
        <button
          className="w-full flex items-center gap-1 px-1 py-0.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <FaChevronDown size={12} className="text-blue-700 dark:text-blue-400" /> : <FaChevronRight size={12} className="text-blue-700 dark:text-blue-400" />}
          {expanded ? <FaFolderOpen size={12} className="text-blue-700 dark:text-blue-400" /> : <FaFolder size={12} className="text-blue-700 dark:text-blue-400" />}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              notes={notes}
              onOpen={onOpen}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  // File node
  const note = notes.find((n) => n.path === node.path);
  return (
    <div className="group flex items-center">
      <button
        className="flex-1 flex items-center gap-1 px-1 py-0.5 text-xs rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors text-zinc-700 dark:text-zinc-300 min-w-0"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => note && onOpen(note.id, node.path)}
      >
        <FaFile size={12} className="shrink-0 text-blue-700 dark:text-blue-400" />
        <span className="truncate">{node.name}</span>
      </button>
      {/* Delete button — visible on hover */}
      <button
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-all shrink-0"
        title="删除文件"
        onClick={(e) => {
          e.stopPropagation();
          if (note) onDelete(note.id);
        }}
      >
        <FaTrashCan size={12} className="text-red-400 hover:text-red-500" />
      </button>
    </div>
  );
});
