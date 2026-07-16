import { Sidebar } from "@/components/sidebar/Sidebar";
import { ActivityBar, type SidebarPane } from "@/components/sidebar/ActivityBar";
import { TabManager } from "@/components/tabs/TabManager";
import { RightSidebar } from "@/components/sidebar/RightSidebar";
import { GraphPanel } from "@/components/sidebar/GraphPanel";
import { CommandPalette } from "@/components/CommandPalette";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StatusBar } from "@/components/StatusBar";
import { WhiteboardPanel } from "@/components/sidebar/WhiteboardPanel";
import { BrowserPanel } from "@/components/sidebar/BrowserPanel";
import { ChatPanel } from "@/components/sidebar/ChatPanel";
import { TerminalPanel } from "@/components/sidebar/TerminalPanel";
import { useSettingsStore } from "@/stores/settingsStore";
import { api } from "@/lib/api";
import { isTauri } from "@/lib/env";
import { loadRecentVaults, addRecentVault, removeRecentVaultLocal } from "@/lib/vaultsLocal";
import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FaChevronDown, FaFolderOpen, FaPlus, FaCheck, FaTrashCan } from "react-icons/fa6";
import { cn } from "@/lib/utils";

/** Compact fallback for panel-level errors — keeps the rest of the app alive. */
function PanelError({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full text-sm text-zinc-400">
      {label || "面板"} 加载失败
    </div>
  );
}

export function MainLayout() {
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const vaultName = useSettingsStore((s) => s.vaultName);
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [activePane, setActivePane] = useState<SidebarPane>("files");

  // Global keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      setShowCmdPalette(true);
    }
  };

  if (!vaultPath) {
    return <VaultPrompt />;
  }

  return (
    <div className="h-screen flex flex-col" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Title Bar */}
      <div className="h-9 bg-zinc-100 dark:bg-zinc-800 flex items-center px-4 text-sm select-none border-b border-zinc-200 dark:border-zinc-700" data-tauri-drag-region>
        <span className="font-medium">{vaultName || "Rainstone"}</span>
        {vaultPath && <VaultSwitcher />}
        <div className="flex-1" />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar activePane={activePane} onPaneChange={setActivePane} />
        {activePane !== "graph" && activePane !== "whiteboard" && activePane !== "browser" && activePane !== "chat" && activePane !== "terminal" && (
          <Sidebar activePane={activePane} />
        )}
        <div className={activePane === "graph" ? "flex-1 min-w-0 bg-white dark:bg-zinc-950 animate-slide-in-right" : "hidden"}>
          <ErrorBoundary fallback={<PanelError label="图谱" />}>
            <GraphPanel />
          </ErrorBoundary>
        </div>
        <div className={activePane === "whiteboard" ? "flex-1 flex flex-col min-w-0" : "hidden"}>
          <WhiteboardPanel />
        </div>
        <div className={activePane === "browser" ? "flex-1 flex flex-col min-w-0" : "hidden"}>
          <BrowserPanel />
        </div>
        <div className={activePane === "chat" ? "flex-1 flex flex-col min-w-0" : "hidden"}>
          <ChatPanel />
        </div>
        <div className={activePane === "terminal" ? "flex-1 flex flex-col min-w-0" : "hidden"}>
          <TerminalPanel />
        </div>

        {activePane !== "graph" && activePane !== "whiteboard" && activePane !== "browser" && activePane !== "chat" && activePane !== "terminal" ? (
          <>
            <div className="flex-1 flex flex-col min-w-0 animate-fade-in">
              <TabManager />
            </div>
            <RightSidebar />
          </>
        ) : null}
      </div>

      <StatusBar />

      {showCmdPalette && <CommandPalette onClose={() => setShowCmdPalette(false)} />}
    </div>
  );
}

function VaultSwitcher() {
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const openVault = useSettingsStore((s) => s.openVault);
  const recentVaults = useSettingsStore((s) => s.recentVaults);
  const setRecentVaults = useSettingsStore((s) => s.setRecentVaults);
  const removeRecentVault = useSettingsStore((s) => s.removeRecentVault);
  const [open_, setOpen_] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load recent vaults
  useEffect(() => {
    if (isTauri()) {
      setRecentVaults(loadRecentVaults());
    } else {
      api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
    }
  }, [setRecentVaults]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen_(false);
    };
    if (open_) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open_]);

  const handleOpenNew = async () => {
    setOpen_(false);
    try {
      setSwitching(true);
      const selected = await open({ directory: true, multiple: false, title: "选择知识库文件夹" });
      if (selected && typeof selected === "string") {
        if (!isTauri()) {
          await api.vaults.open(selected);
        }
        const name = selected.split(/[/\\]/).filter(Boolean).pop() || "知识库";
        openVault(selected, name);
        if (isTauri()) {
          const now = new Date().toISOString();
          setRecentVaults(addRecentVault({ path: selected, name, opened_at: now }));
        } else {
          api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Failed to open vault:", e);
    } finally {
      setSwitching(false);
    }
  };

  const handleSwitch = async (path: string, name: string) => {
    setOpen_(false);
    if (path === vaultPath) return;
    try {
      setSwitching(true);
      if (!isTauri()) {
        await api.vaults.open(path);
      }
      openVault(path, name);
      if (isTauri()) {
        const now = new Date().toISOString();
        setRecentVaults(addRecentVault({ path, name, opened_at: now }));
      } else {
        api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to switch vault:", e);
    } finally {
      setSwitching(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      if (isTauri()) {
        setRecentVaults(removeRecentVaultLocal(path));
      } else {
        await api.vaults.removeRecent(path);
      }
      removeRecentVault(path);
    } catch {}
  };

  return (
    <div className="relative ml-3" ref={ref}>
      <button
        onClick={() => setOpen_(!open_)}
        disabled={switching}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      >
        {switching ? "切换中..." : "切换"}
        <FaChevronDown size={12} className={cn("transition-transform text-zinc-400", open_ && "rotate-180")} />
      </button>

      {open_ && (
        <div className="absolute top-full mt-1 left-0 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 py-1">
          {/* Open new vault */}
          <button
            onClick={handleOpenNew}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <FaPlus size={14} className="text-accent" />
            打开新知识库...
          </button>

          {/* Divider */}
          {recentVaults.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 my-1" />
          )}

          {/* Recent vaults */}
          {recentVaults.map((v) => (
            <div
              key={v.path}
              className="group flex items-center w-full"
            >
              <button
                onClick={() => handleSwitch(v.path, v.name)}
                className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-0"
              >
                <FaFolderOpen size={14} className="text-zinc-400 shrink-0" />
                <span className="truncate">{v.name}</span>
                {v.path === vaultPath && (
                  <FaCheck size={14} className="text-accent shrink-0 ml-auto" />
                )}
              </button>
              <button
                onClick={(e) => handleRemove(e, v.path)}
                className="p-1 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 shrink-0"
                title="从列表中移除"
              >
                <FaTrashCan size={12} className="text-zinc-400" />
              </button>
            </div>
          ))}

          {recentVaults.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-400">暂无最近打开的知识库</p>
          )}
        </div>
      )}
    </div>
  );
}

function VaultPrompt() {
  const [loading, setLoading] = useState(false);
  const openVault = useSettingsStore((s) => s.openVault);
  const setRecentVaults = useSettingsStore((s) => s.setRecentVaults);
  const recentVaults = useSettingsStore((s) => s.recentVaults);

  useEffect(() => {
    if (isTauri()) {
      setRecentVaults(loadRecentVaults());
    } else {
      api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
    }
  }, [setRecentVaults]);

  const handleOpenVault = async () => {
    try {
      setLoading(true);
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择知识库文件夹",
      });
      if (selected && typeof selected === "string") {
        if (!isTauri()) {
          await api.vaults.open(selected);
        }
        const name = selected.split(/[/\\]/).filter(Boolean).pop() || "知识库";
        openVault(selected, name);
        if (isTauri()) {
          const now = new Date().toISOString();
          setRecentVaults(addRecentVault({ path: selected, name, opened_at: now }));
        } else {
          api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Failed to open folder dialog:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (path: string, name: string) => {
    try {
      setLoading(true);
      if (!isTauri()) {
        await api.vaults.open(path);
      }
      openVault(path, name);
      if (isTauri()) {
        const now = new Date().toISOString();
        setRecentVaults(addRecentVault({ path, name, opened_at: now }));
      } else {
        api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
      }
    } catch (e) {
      console.error("Failed to open recent vault:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold">Rainstone</h1>
        <p className="text-zinc-500 dark:text-zinc-400">打开一个知识库开始使用</p>
        <button
          className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          onClick={handleOpenVault}
          disabled={loading}
        >
          {loading ? "打开中..." : "打开知识库"}
        </button>

        {/* Recent vaults on welcome screen */}
        {recentVaults.length > 0 && (
          <div className="mt-8 text-left max-w-sm mx-auto">
            <p className="text-xs text-zinc-400 mb-2 text-center">最近打开</p>
            <div className="space-y-1">
              {recentVaults.map((v) => (
                <button
                  key={v.path}
                  onClick={() => handleOpenRecent(v.path, v.name)}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <FaFolderOpen size={14} className="text-zinc-400" />
                  <span className="truncate">{v.name}</span>
                  <span className="text-xs text-zinc-400 truncate ml-auto">{v.path}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
