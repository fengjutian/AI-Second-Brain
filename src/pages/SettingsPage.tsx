import { ArrowLeft, Sun, Moon, Monitor, Upload, Loader2, Puzzle, Power, PowerOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore, type Theme } from "@/stores/settingsStore";
import { usePluginStore } from "@/stores/pluginStore";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function SettingsPage() {
  const navigate = useNavigate();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const themes: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "浅色", icon: Sun },
    { id: "dark", label: "深色", icon: Moon },
    { id: "system", label: "跟随系统", icon: Monitor },
  ];

  return (
    <div className="h-screen flex flex-col">
      <div className="h-12 flex items-center px-4 gap-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
        <button onClick={() => navigate("/")} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ArrowLeft size={18} />
        </button>
        <span className="font-medium">设置</span>
      </div>
      <div className="flex-1 max-w-2xl mx-auto w-full p-8 space-y-8">
        {/* Theme */}
        <section>
          <h3 className="text-sm font-medium mb-3">主题</h3>
          <div className="flex gap-2">
            {themes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors",
                  theme === id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
                onClick={() => setTheme(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Plugins */}
        <section>
          <h3 className="text-sm font-medium mb-3">插件</h3>
          <PluginSection />
        </section>

        {/* Import */}
        <section>
          <h3 className="text-sm font-medium mb-3">导入</h3>
          <ImportSection />
        </section>

        {/* Plugins */}
        <section>
          <h3 className="text-sm font-medium mb-3">插件</h3>
          <PluginSection />
        </section>

        {/* About */}
        <section>
          <h3 className="text-sm font-medium mb-3">关于</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">AI Second Brain v0.1.0</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Tauri + React + FastAPI</p>
        </section>
      </div>
    </div>
  );
}

function ImportSection() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleImport = async () => {
    const path = prompt("请输入 Obsidian 仓库的路径：");
    if (!path) return;

    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("http://localhost:8710/api/v1/import/obsidian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_path: path }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`❌ ${data.error}`);
      } else {
        setResult(`✅ 导入 ${data.imported} 篇笔记，跳过 ${data.skipped} 篇，共 ${data.total_notes} 篇`);
      }
    } catch (e) {
      setResult(`❌ 请求失败：${e}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        从 Obsidian 仓库导入所有 .md 笔记文件（跳过 .obsidian 等配置）
      </p>
      <button
        onClick={handleImport}
        disabled={importing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        导入 Obsidian 仓库
      </button>
      {result && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{result}</p>
      )}
    </div>
  );
}

function PluginSection() {
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
          <Puzzle size={16} className="text-accent shrink-0" />
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
            {entry.enabled ? <Power size={16} /> : <PowerOff size={16} />}
          </button>
        </div>
      ))}
    </div>
  );
}
