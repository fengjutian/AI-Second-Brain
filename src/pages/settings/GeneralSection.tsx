import { FaSun, FaMoon, FaDisplay, FaFolderOpen, FaTrashCan } from "react-icons/fa6";
import { useSettingsStore, type Theme } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

const themes: { id: Theme; label: string; icon: typeof FaSun }[] = [
  { id: "light", label: "浅色", icon: FaSun },
  { id: "dark", label: "深色", icon: FaMoon },
  { id: "system", label: "跟随系统", icon: FaDisplay },
];

export function GeneralSection() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const vaultName = useSettingsStore((s) => s.vaultName);
  const recentVaults = useSettingsStore((s) => s.recentVaults);
  const setRecentVaults = useSettingsStore((s) => s.setRecentVaults);
  const removeRecentVault = useSettingsStore((s) => s.removeRecentVault);
  const openVault = useSettingsStore((s) => s.openVault);
  const offlineMode = useSettingsStore((s) => s.offlineMode);
  const setOfflineMode = useSettingsStore((s) => s.setOfflineMode);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
  }, [setRecentVaults]);

  const handleOpenVault = useCallback(async () => {
    try {
      setOpening(true);
      const selected = await open({ directory: true, multiple: false, title: "选择知识库文件夹" });
      if (selected && typeof selected === "string") {
        await api.vaults.open(selected);
        const name = selected.split(/[/\\]/).filter(Boolean).pop() || "知识库";
        openVault(selected, name);
        api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to open vault:", e);
    } finally {
      setOpening(false);
    }
  }, [openVault, setRecentVaults]);

  const handleSwitchVault = useCallback(async (path: string, name: string) => {
    try {
      setOpening(true);
      await api.vaults.open(path);
      openVault(path, name);
      api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
    } catch (e) {
      console.error("Failed to switch vault:", e);
    } finally {
      setOpening(false);
    }
  }, [openVault, setRecentVaults]);

  const handleRemoveRecent = useCallback(async (path: string) => {
    try {
      await api.vaults.removeRecent(path);
      removeRecentVault(path);
    } catch (e) {
      console.error("Failed to remove recent vault:", e);
    }
  }, [removeRecentVault]);

  return (
    <div className="space-y-8">
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

      <section>
        <h3 className="text-sm font-medium mb-3">当前知识库</h3>
        {vaultPath ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <FaFolderOpen size={18} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{vaultName}</p>
              <p className="text-xs text-zinc-400 truncate">{vaultPath}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">未打开知识库</p>
        )}
        <button
          onClick={handleOpenVault}
          disabled={opening}
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <FaFolderOpen size={16} className="text-sky-500" />
          {opening ? "打开中..." : vaultPath ? "切换到其他知识库" : "打开知识库"}
        </button>
      </section>

      {recentVaults.length > 0 && (
        <section>
          <h3 className="text-sm font-medium mb-3">最近打开</h3>
          <div className="space-y-1">
            {recentVaults.map((v) => (
              <div
                key={v.path}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg transition-colors group",
                  v.path === vaultPath
                    ? "bg-accent/5 border border-accent/20"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                <button
                  className="flex-1 flex items-center gap-3 min-w-0 text-left"
                  onClick={() => handleSwitchVault(v.path, v.name)}
                  disabled={opening || v.path === vaultPath}
                >
                  <FaFolderOpen size={16} className="text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{v.name}</p>
                    <p className="text-xs text-zinc-400 truncate">{v.path}</p>
                  </div>
                </button>
                <button
                  onClick={() => handleRemoveRecent(v.path)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                  title="从列表中移除"
                >
                  <FaTrashCan size={14} className="text-zinc-400" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-medium mb-3">网络</h3>
        <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div>
            <p className="text-sm font-medium">离线模式</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              阻止所有网络请求，仅使用本地文件
            </p>
          </div>
          <button
            onClick={() => setOfflineMode(!offlineMode)}
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors",
              offlineMode ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                offlineMode ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-3">关于</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Rainstone v0.1.0</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Tauri + React + FastAPI</p>
      </section>
    </div>
  );
}
