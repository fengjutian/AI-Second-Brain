import { FaFolder, FaMagnifyingGlass, FaCodeBranch, FaGear } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export type SidebarPane = "files" | "search" | "graph";

interface ActivityBarProps {
  activePane: SidebarPane;
  onPaneChange: (pane: SidebarPane) => void;
}

const topActions: { id: SidebarPane; icon: typeof FaFolder; label: string }[] = [
  { id: "files", icon: FaFolder, label: "文件" },
  { id: "search", icon: FaMagnifyingGlass, label: "搜索" },
  { id: "graph", icon: FaCodeBranch, label: "图谱" },
];

export function ActivityBar({ activePane, onPaneChange }: ActivityBarProps) {
  const navigate = useNavigate();

  return (
    <div className="w-12 bg-zinc-100 dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 flex flex-col items-center py-2 gap-1 shrink-0">
      {/* Pane switchers */}
      {topActions.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onPaneChange(id)}
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative group",
            activePane === id
              ? "text-accent bg-accent/10"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          )}
          title={label}
        >
          <Icon size={20} />
          {activePane === id && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent rounded-r" />
          )}
          <span className="absolute left-full ml-2 px-2 py-1 text-xs bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-800 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {label}
          </span>
        </button>
      ))}

      <div className="flex-1" />

      {/* Settings */}
      <button
        onClick={() => navigate("/settings")}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors relative group"
        title="设置"
      >
        <FaGear size={20} />
        <span className="absolute left-full ml-2 px-2 py-1 text-xs bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-800 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
          设置
        </span>
      </button>
    </div>
  );
}
