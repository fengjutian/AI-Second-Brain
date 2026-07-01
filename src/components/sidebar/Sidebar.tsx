import { useState } from "react";
import { FaPlus, FaCalendar } from "react-icons/fa6";
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
        {activePane === "files" && <FileTreePane />}
        {activePane === "search" && <SearchPane />}
      </div>
    </div>
  );
}

function FileTreePane() {
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
      </div>

      <FileTree />

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

function SearchPane() {
  return <SearchPanel />;
}
