import { useState, useEffect, useRef, useMemo } from "react";
import { Search, FilePlus, GitGraph, Settings, Calendar, Puzzle } from "lucide-react";
import { useTabStore } from "@/stores/tabStore";
import { useNavigate } from "react-router-dom";
import { getRegisteredCommands } from "@/stores/pluginStore";

interface Command {
  id: string;
  label: string;
  icon: typeof Search;
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
  const navigate = useNavigate();

  const commands: Command[] = useMemo(() => [
    {
      id: "new-note",
      label: "新建笔记",
      icon: FilePlus,
      action: () => {
        openTab({ noteId: `new-${Date.now()}`, title: "未命名", path: "" });
        onClose();
      },
    },
    {
      id: "daily-note",
      label: "打开日记",
      icon: Calendar,
      action: async () => {
        try {
          const { api } = await import("@/lib/api");
          const note = await api.daily.today();
          if (note?.id) {
            const { useNoteStore } = await import("@/stores/noteStore");
            useNoteStore.getState().loadNote(note.id, note);
            openTab({ noteId: note.id, title: note.title, path: note.path });
          }
        } catch {}
        onClose();
      },
    },
    {
      id: "graph",
      label: "知识图谱",
      icon: GitGraph,
      action: () => { navigate("/graph"); onClose(); },
    },
    {
      id: "settings",
      label: "设置",
      icon: Settings,
      action: () => { navigate("/settings"); onClose(); },
    },
    // Plugin commands
    ...getRegisteredCommands().map((cmd) => ({
      id: cmd.id,
      label: cmd.name,
      icon: Puzzle,
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
          <Search size={18} className="text-zinc-400 mr-2" />
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
