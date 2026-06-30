import { useState } from "react";
import { ArrowRight, ArrowLeft, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

type Pane = "outgoing" | "backlinks" | "tags" | "ai";

export function RightSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [activePane, setActivePane] = useState<Pane>("outgoing");

  if (collapsed) {
    return (
      <button
        className="w-8 border-l border-zinc-200 dark:border-zinc-700 flex items-start justify-center pt-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
        onClick={() => setCollapsed(false)}
      >
        <ArrowLeft size={14} />
      </button>
    );
  }

  const tabs: { id: Pane; label: string }[] = [
    { id: "outgoing", label: "出链" },
    { id: "backlinks", label: "反链" },
    { id: "tags", label: "标签" },
  ];

  return (
    <div className="w-60 bg-zinc-50 dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-1">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              className={cn(
                "px-2 py-1 text-xs rounded-md transition-colors",
                activePane === id
                  ? "bg-accent text-white"
                  : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              )}
              onClick={() => setActivePane(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => setCollapsed(true)}
        >
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-sm text-zinc-500 dark:text-zinc-400">
        {activePane === "outgoing" && <p>打开一篇笔记查看出链</p>}
        {activePane === "backlinks" && <p>打开一篇笔记查看反链</p>}
        {activePane === "tags" && <p>打开一篇笔记编辑标签</p>}
      </div>
    </div>
  );
}
