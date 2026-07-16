import { useState, useEffect } from "react";
import { FaArrowRight, FaArrowLeft, FaComment } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { api } from "@/lib/api";
import { isTauri } from "@/lib/env";
import { outgoingLinks, backlinks as getBacklinks, rebuildIndex } from "@/lib/localIndex";

type Pane = "outgoing" | "backlinks" | "tags" | "ai";

// Static tabs list — not recreated on every render
const paneTabs: { id: Pane; label: string; icon?: typeof FaComment }[] = [
  { id: "outgoing", label: "出链" },
  { id: "backlinks", label: "反链" },
  { id: "ai", label: "AI", icon: FaComment },
];

interface LinkItem {
  id: number;
  target_id: string | null;
  target_text: string;
  target_title: string | null;
  target_path: string | null;
  anchor: string | null;
}

export function RightSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activePane, setActivePane] = useState<Pane>("outgoing");
  const currentId = useNoteStore((s) => s.currentId);
  const loadNote = useNoteStore((s) => s.loadNote);
  const openTab = useTabStore((s) => s.openTab);

  const [outgoing, setOutgoing] = useState<LinkItem[]>([]);
  const [backlinks, setBacklinks] = useState<LinkItem[]>([]);

  useEffect(() => {
    if (!currentId) {
      setOutgoing([]);
      setBacklinks([]);
      return;
    }
    let cancelled = false;

    if (isTauri()) {
      const vaultPath = useSettingsStore.getState().vaultPath;
      if (!vaultPath || !currentId) return;
      rebuildIndex(vaultPath).then(() => {
        if (cancelled) return;
        outgoingLinks(vaultPath, currentId).then((data) => {
          if (!cancelled) setOutgoing(data.map((l: any, i: number) => ({
            id: i, target_id: l.target_id, target_text: l.target_text,
            target_title: l.target_text, target_path: null, anchor: null,
          })));
        }).catch(() => {});
        getBacklinks(vaultPath, currentId).then((data) => {
          if (!cancelled) setBacklinks(data.map((l: any, i: number) => ({
            id: i, target_id: l.source_id, target_text: l.target_text,
            target_title: l.target_text, target_path: null, anchor: null,
          })));
        }).catch(() => {});
      }).catch(() => {});
    } else {
      api.notes.outgoingLinks(currentId).then((data) => {
        if (!cancelled) setOutgoing(data);
      }).catch(() => {});
      api.notes.backlinks(currentId).then((data) => {
        if (!cancelled) setBacklinks(data);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [currentId]);

  const handleOpenLink = async (item: LinkItem) => {
    if (!item.target_id) return;
    try {
      const note = await api.notes.get(item.target_id);
      if (note) {
        loadNote(note.id, note);
        openTab({ noteId: note.id, title: note.title, path: note.path });
      }
    } catch {}
  };

  if (collapsed) {
    return (
      <button
        className="w-8 border-l border-zinc-200 dark:border-zinc-700 flex items-start justify-center pt-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
        onClick={() => setCollapsed(false)}
      >
        <FaArrowLeft size={14} className="text-zinc-400" />
      </button>
    );
  }

  return (
    <div className="w-60 bg-zinc-50 dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col shrink-0 animate-fade-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-1">
          {paneTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={cn(
                "px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1",
                activePane === id
                  ? "bg-accent text-white"
                  : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              )}
              onClick={() => setActivePane(id)}
            >
              {Icon && <Icon size={12} />}
              {label}
            </button>
          ))}
        </div>
        <button
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => setCollapsed(true)}
        >
          <FaArrowRight size={14} className="text-zinc-400" />
        </button>
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activePane === "outgoing" && (
          <LinkList items={outgoing} empty="暂无出链" onOpen={handleOpenLink} />
        )}
        {activePane === "backlinks" && (
          <LinkList items={backlinks} empty="暂无反向链接" onOpen={handleOpenLink} />
        )}
        {activePane === "ai" && (
          <ErrorBoundary fallback={<div className="p-3 text-sm text-zinc-400">AI 面板加载失败</div>}>
            <ChatPanel />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

function LinkList({
  items,
  empty,
  onOpen,
}: {
  items: LinkItem[];
  empty: string;
  onOpen: (item: LinkItem) => void;
}) {
  if (items.length === 0) {
    return <div className="p-3 text-sm text-zinc-400 dark:text-zinc-500">{empty}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors"
          onClick={() => onOpen(item)}
        >
          <div className="font-medium truncate text-zinc-700 dark:text-zinc-300">
            {item.target_title || item.target_text}
          </div>
          {item.target_path && (
            <div className="text-xs text-zinc-400 truncate">{item.target_path}</div>
          )}
        </button>
      ))}
    </div>
  );
}
