import { useState, useEffect, useRef, useMemo } from "react";
import { FaMagnifyingGlass, FaFileCirclePlus, FaCodeBranch, FaGear, FaCalendar, FaPuzzlePiece, FaTrashCan } from "react-icons/fa6";
import { useTabStore } from "@/stores/tabStore";
import { useNavigate } from "react-router-dom";
import { getRegisteredCommands } from "@/stores/pluginStore";

interface Command {
  id: string;
  label: string;
  icon: typeof FaMagnifyingGlass;
  action: () => void;
}

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const navigate = useNavigate();

  const commands: Command[] = useMemo(() => [
    {
      id: "new-note",
      label: "新建笔记",
      icon: FaFileCirclePlus,
      action: () => {
        openTab({ noteId: `new-${Date.now()}`, title: "未命名", path: "" });
        onClose();
      },
    },
    {
      id: "daily-note",
      label: "打开日记",
      icon: FaCalendar,
      action: async () => {
        try {
          const { isTauri: checkTauri } = await import("@/lib/env");
          if (checkTauri()) {
            const { useSettingsStore } = await import("@/stores/settingsStore");
            const vaultPath = useSettingsStore.getState().vaultPath;
            const today = new Date().toISOString().slice(0, 10);
            const relPath = `daily/${today}.md`;
            const filePath = `${vaultPath}/${relPath}`;
            const { exists, readTextFile, writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
            if (await exists(filePath)) {
              const raw = await readTextFile(filePath);
              const content = raw.startsWith("---\n")
                ? raw.slice(raw.indexOf("\n---\n", 4) + 5).trimStart()
                : raw;
              const { useNoteStore } = await import("@/stores/noteStore");
              useNoteStore.getState().loadNote(filePath, { id: filePath, path: relPath, title: today, content });
              openTab({ noteId: filePath, title: today, path: relPath });
            } else {
              const dailyDir = `${vaultPath}/daily`;
              if (!(await exists(dailyDir))) await mkdir(dailyDir);
              const noteId = crypto.randomUUID();
              const now = new Date().toISOString();
              const frontmatter = `---\nid: ${noteId}\ntitle: ${today}\ncreated: ${now}\nupdated: ${now}\ntags: ["daily"]\n---\n\n# ${today}\n\n`;
              await writeTextFile(filePath, frontmatter);
              const { useNoteStore } = await import("@/stores/noteStore");
              useNoteStore.getState().loadNote(filePath, { id: filePath, path: relPath, title: today, content: `# ${today}\n\n` });
              openTab({ noteId: filePath, title: today, path: relPath });
            }
          } else {
            const { api } = await import("@/lib/api");
            const note = await api.daily.today();
            if (note?.id) {
              const { useNoteStore } = await import("@/stores/noteStore");
              useNoteStore.getState().loadNote(note.id, note);
              openTab({ noteId: note.id, title: note.title, path: note.path });
            }
          }
        } catch {}
        onClose();
      },
    },
    {
      id: "graph",
      label: "知识图谱",
      icon: FaCodeBranch,
      action: () => { navigate("/graph"); onClose(); },
    },
    {
      id: "settings",
      label: "设置",
      icon: FaGear,
      action: () => { navigate("/settings"); onClose(); },
    },
    {
      id: "delete-note",
      label: "删除当前笔记",
      icon: FaTrashCan,
      action: async () => {
        const { useNoteStore } = await import("@/stores/noteStore");
        const currentId = useNoteStore.getState().currentId;
        const note = currentId ? (useNoteStore.getState().notes[currentId] ?? null) : null;
        if (!note) return;
        if (!confirm(`确定删除「${note.title}」？\n\n笔记会被移到 .trash 目录。`)) return;
        try {
          const { api } = await import("@/lib/api");
          await api.notes.delete(currentId);
          useNoteStore.getState().removeNote(currentId);
          closeTab(currentId);
        } catch (e) {
          console.error("Delete failed:", e);
        }
        onClose();
      },
    },
    // Plugin commands
    ...getRegisteredCommands().map((cmd) => ({
      id: cmd.id,
      label: cmd.name,
      icon: FaPuzzlePiece,
      action: () => { cmd.callback(); onClose(); },
    })),
  ], [openTab, navigate, onClose]);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[selectedIdx]?.action();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="flex items-center px-4 border-b border-zinc-200 dark:border-zinc-700">
          <FaMagnifyingGlass size={18} className="text-zinc-400 mr-2" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令或搜索..."
            className="flex-1 py-3 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                idx === selectedIdx
                  ? "bg-accent/10 text-accent"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              onClick={cmd.action}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <cmd.icon size={16} />
              {cmd.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">无匹配命令</div>
          )}
        </div>
      </div>
    </div>
  );
}
