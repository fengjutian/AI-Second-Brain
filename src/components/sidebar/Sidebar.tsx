import { useState } from "react";
import { FaPlus, FaCalendar, FaTags, FaArrowLeft } from "react-icons/fa6";
import { FileTree } from "@/components/sidebar/FileTree";
import { SearchPanel } from "@/components/search/SearchPanel";
import type { SidebarPane } from "@/components/sidebar/ActivityBar";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { api } from "@/lib/api";
import { InputDialog } from "@/components/ui/InputDialog";

interface SidebarProps {
  activePane: SidebarPane;
}

export function Sidebar({ activePane }: SidebarProps) {
  return (
    <div className="w-60 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 flex flex-col shrink-0">
      <div className="flex-1 overflow-y-auto p-2">
        <div className="transition-opacity duration-150" style={{ opacity: activePane === "files" ? 1 : 0, pointerEvents: activePane === "files" ? "auto" : "none", position: activePane === "files" ? "static" : "absolute" }}>
          <FileTreePane />
        </div>
        <div className="transition-opacity duration-150" style={{ opacity: activePane === "search" ? 1 : 0, pointerEvents: activePane === "search" ? "auto" : "none", position: activePane === "search" ? "static" : "absolute" }}>
          <SearchPane />
        </div>
      </div>
    </div>
  );
}

type View = "tree" | "tags";

function FileTreePane() {
  const [view, setView] = useState<View>("tree");
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const loadNote = useNoteStore((s) => s.loadNote);
  const openTab = useTabStore((s) => s.openTab);

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
      if (note?.id) {
        loadNote(note.id, note);
        openTab({ noteId: note.id, title: note.title, path: note.path });
      }
    } catch (e) {
      console.error("Failed to open daily note:", e);
    }
  };

  return (
    <>
      {/* Quick actions */}
      <div className="flex gap-1 mb-2">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title="新建笔记"
          onClick={() => setNewNoteOpen(true)}
        >
          <FaPlus size={14} className="text-green-500" /> 新建
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title="日记"
          onClick={openDaily}
        >
          <FaCalendar size={14} className="text-amber-500" /> 日记
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          title="标签管理"
          onClick={() => setView(view === "tags" ? "tree" : "tags")}
        >
          <FaTags size={14} className="text-violet-500" /> 标签
        </button>
      </div>

      {view === "tags" ? (
        <div className="animate-fade-in">
          <TagsPanel onBack={() => setView("tree")} />
        </div>
      ) : (
        <div className="animate-fade-in">
          <FileTree />
        </div>
      )}

      <InputDialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
        title="新建笔记"
        placeholder="笔记名（不含 .md）"
        confirmLabel="创建"
        onConfirm={handleCreateNote}
      />
    </>
  );
}

function TagsPanel({ onBack }: { onBack: () => void }) {
  const notes = useNoteStore((s) => s.notes);
  const loadNote = useNoteStore((s) => s.loadNote);
  const openTab = useTabStore((s) => s.openTab);

  const tagMap = useMemo(() => {
    const map = new Map<string, string[]>();
    notes.forEach((note) => {
      note.tags?.forEach((tag) => {
        if (!map.has(tag)) map.set(tag, []);
        map.get(tag)!.push(note.id);
      });
    });
    return map;
  }, [notes]);

  const sorted = useMemo(
    () => Array.from(tagMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    [tagMap]
  );

  const handleOpenNote = async (noteId: string) => {
    try {
      const note = await api.notes.get(noteId);
      if (note) {
        loadNote(note.id, note);
        openTab({ noteId: note.id, title: note.title, path: note.path });
      }
    } catch {}
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mb-2 transition-colors"
      >
        <FaArrowLeft size={10} />
        返回文件
      </button>
      <div className="text-xs text-zinc-400 mb-2">
        按标签浏览 · {sorted.length} 个标签
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-400">暂无标签</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(([tag, noteIds]) => (
            <div key={tag}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-xs font-medium text-violet-500">#{tag}</span>
                <span className="text-[10px] text-zinc-400">{noteIds.length}</span>
              </div>
              <div className="space-y-0.5">
                {noteIds.map((noteId) => {
                  const note = notes.get(noteId);
                  return note ? (
                    <button
                      key={noteId}
                      onClick={() => handleOpenNote(noteId)}
                      className="w-full text-left px-2 py-1 text-xs rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 truncate"
                    >
                      {note.title}
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchPane() {
  return <SearchPanel />;
}
