import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore, type Theme } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

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
