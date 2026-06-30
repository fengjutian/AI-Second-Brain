import { useTabStore } from "@/stores/tabStore";
import { Editor } from "@/components/editor/Editor";
import { X, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

export function TabManager() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActive = useTabStore((s) => s.setActive);
  const closeTab = useTabStore((s) => s.closeTab);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
        <div className="text-center space-y-2">
          <p className="text-lg">AI Second Brain</p>
          <p className="text-sm">Ctrl+N 新建笔记 ｜ Ctrl+P 命令面板</p>
        </div>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab Bar */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto shrink-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-r border-zinc-200 dark:border-zinc-700 min-w-0 max-w-48 transition-colors select-none",
              tab.id === activeTabId
                ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
            )}
            onClick={() => setActive(tab.id)}
          >
            <span className="truncate flex-1 text-xs">{tab.title || "未命名"}</span>
            {tab.isDirty && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab && <Editor key={activeTab.id} tabId={activeTab.id} noteId={activeTab.noteId} />}
      </div>
    </div>
  );
}
