import { useState } from "react";
import { FaFolder, FaMagnifyingGlass, FaPlus, FaTags, FaStar, FaCalendar, FaGear } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { FileTree } from "@/components/sidebar/FileTree";
import { SearchPanel } from "@/components/search/SearchPanel";
import { api } from "@/lib/api";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { InputDialog } from "@/components/ui/InputDialog";
import { useNavigate } from "react-router-dom";

// Static icons — not recreated on every render
const paneIcons = [
  { id: "files" as const, icon: FaFolder, label: "文件" },
  { id: "search" as const, icon: FaMagnifyingGlass, label: "搜索" },
  { id: "tags" as const, icon: FaTags, label: "标签" },
];

export function Sidebar() {
  const [activePane, setActivePane] = useState<"files" | "search" | "tags">("files");
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const loadNote = useNoteStore((s) => s.loadNote);
  const openTab = useTabStore((s) => s.openTab);
  const navigate = useNavigate();

  const handleCreateNote = async (name: string) => {
    try {
      const note = await api.notes.create({ path: `${name}.md` });
      loadNote(note.id, note);
      openTab({ noteId: note.id, title: note.title, path: note.path });
    } catch (e) {
      console.error("Failed to create note:", e);
    }
  };

  const openDaily = async () => {
    try {
      const note = await api.daily.today();
      if (note && note.id) {
        loadNote(note.id, note);
        openTab({ noteId: note.id, title: note.title, path: note.path });
      }
    } catch (e) {
      console.error("Failed to open daily note:", e);
    }
  };

  return (
    <div className="w-60 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 flex flex-col shrink-0">
      {/* Quick Actions */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 flex gap-1">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title="新建笔记"
          onClick={() => setNewNoteOpen(true)}
        >
          <FaPlus size={14} /> 新建
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title="日记"
          onClick={openDaily}
        >
          <FaCalendar size={14} /> 日记
        </button>
      </div>

      {/* Pane Switcher */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        {paneIcons.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={cn(
              "flex-1 py-2 flex justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors",
              activePane === id && "text-accent border-b-2 border-accent"
            )}
            onClick={() => setActivePane(id)}
            title={label}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activePane === "files" && <FileTreePane />}
        {activePane === "search" && <FaMagnifyingGlassPane />}
        {activePane === "tags" && <TagsPane />}
      </div>

      {/* Settings */}
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700 transition-colors"
        title="设置"
      >
        <FaGear size={14} />
        设置
      </button>

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

function FileTreePane() {
  return <FileTree />;
}

function SearchPane() {
  return <FaMagnifyingGlassPanel />;
}

function TagsPane() {
  return (
    <div className="text-sm text-zinc-500 dark:text-zinc-400 p-2">
      <p>暂无标签</p>
    </div>
  );
}
