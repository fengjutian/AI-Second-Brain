import { useEffect, useState, useMemo, memo, useCallback } from "react";
import { File, Folder, FolderOpen, ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useTabStore } from "@/stores/tabStore";
import { useNoteStore } from "@/stores/noteStore";
import { cn } from "@/lib/utils";
import { InputDialog } from "@/components/ui/InputDialog";

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

export function FileTree() {
  const [notes, setNotes] = useState<{ id: string; path: string; title: string }[]>([]);
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const openTab = useTabStore((s) => s.openTab);
  const loadNote = useNoteStore((s) => s.loadNote);

  useEffect(() => {
    api.notes.list().then(setNotes).catch(() => {});
  }, []);

  const tree = useMemo(() => buildTree(notes), [notes]);

  const handleOpen = useCallback(async (noteId: string, path: string) => {
    const note = await api.notes.get(noteId);
    loadNote(noteId, note);
    openTab({ noteId, title: note.title, path: note.path });
  }, [loadNote, openTab]);

  const handleCreateNote = async (name: string) => {
    const path = `${name}.md`;
    const note = await api.notes.create({ path });
    setNotes((prev) => [...prev, { id: note.id, path: note.path, title: note.title }]);
    loadNote(note.id, note);
    openTab({ noteId: note.id, title: note.title, path: note.path });
  };

  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!confirm("确定删除这篇笔记？\n\n笔记会被移到 .trash 目录，可以手动恢复。")) return;
    try {
      await api.notes.delete(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e) {
      console.error("Failed to delete note:", e);
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
        <p className="text-xs text-zinc-400 px-1 py-2">暂无笔记</p>
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
}

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
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {expanded ? <FolderOpen size={12} /> : <Folder size={12} />}
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
        <File size={12} className="shrink-0" />
        <span className="truncate">{node.name.replace(/\.md$/, "")}</span>
      </button>
      {/* Delete button — visible on hover */}
      <button
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-500 transition-all shrink-0"
        title="删除笔记"
        onClick={(e) => {
          e.stopPropagation();
          if (note) onDelete(note.id);
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
});
