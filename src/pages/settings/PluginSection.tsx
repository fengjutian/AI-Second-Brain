import { FaPuzzlePiece, FaPowerOff } from "react-icons/fa6";
import { usePluginStore } from "@/stores/pluginStore";
import { cn } from "@/lib/utils";

export function PluginSection() {
  const plugins = usePluginStore((s) => s.plugins);
  const setEnabled = usePluginStore((s) => s.setEnabled);

  if (plugins.length === 0) {
    return (
      <p className="text-sm text-zinc-400 dark:text-zinc-500">
        暂无插件。将插件放入 vault/plugins/ 目录即可加载。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {plugins.map((entry) => (
        <div
          key={entry.manifest.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700"
        >
          <FaPuzzlePiece size={16} className="text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{entry.manifest.name}</span>
              <span className="text-xs text-zinc-400">{entry.manifest.version}</span>
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                entry.source === "core" ? "bg-accent/10 text-accent" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
              )}>
                {entry.source === "core" ? "内置" : entry.source}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {entry.manifest.description}
            </p>
          </div>
          <button
            onClick={() => setEnabled(entry.manifest.id, !entry.enabled)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              entry.enabled
                ? "text-accent hover:bg-accent/10"
                : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
            title={entry.enabled ? "停用" : "启用"}
          >
            {entry.enabled ? <FaPowerOff size={16} className="text-green-500" /> : <FaPowerOff size={16} className="text-zinc-300 dark:text-zinc-600" />}
          </button>
        </div>
      ))}
    </div>
  );
}
