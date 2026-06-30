import { useState } from "react";
import { Folder, Search, Plus, Tags, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [activePane, setActivePane] = useState<"files" | "search" | "tags">("files");

  const icons = [
    { id: "files" as const, icon: Folder, label: "文件" },
    { id: "search" as const, icon: Search, label: "搜索" },
    { id: "tags" as const, icon: Tags, label: "标签" },
  ];

  return (
    <div className="w-60 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 flex flex-col shrink-0">
      {/* Quick Actions */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 flex gap-1">
        <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="新建笔记">
          <Plus size={14} /> 新建
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="日记">
          <Star size={14} /> 日记
        </button>
      </div>

      {/* Pane Switcher */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        {icons.map(({ id, icon: Icon, label }) => (
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
        {activePane === "files" && <FileTree />}
        {activePane === "search" && <SearchPane />}
        {activePane === "tags" && <TagsPane />}
      </div>
    </div>
  );
}

function FileTree() {
  return (
    <div className="text-sm text-zinc-500 dark:text-zinc-400">
      <p className="p-2">暂无笔记，点击 + 新建</p>
    </div>
  );
}

function SearchPane() {
  return (
    <div className="p-2">
      <input
        type="text"
        placeholder="搜索笔记..."
        className="w-full px-3 py-1.5 text-sm rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-accent transition-colors"
      />
    </div>
  );
}

function TagsPane() {
  return (
    <div className="text-sm text-zinc-500 dark:text-zinc-400 p-2">
      <p>暂无标签</p>
    </div>
  );
}
