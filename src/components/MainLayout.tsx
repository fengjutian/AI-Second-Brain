import { Sidebar } from "@/components/sidebar/Sidebar";
import { TabManager } from "@/components/tabs/TabManager";
import { RightSidebar } from "@/components/sidebar/RightSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { StatusBar } from "@/components/StatusBar";
import { useSettingsStore } from "@/stores/settingsStore";
import { api } from "@/lib/api";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

export function MainLayout() {
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const vaultName = useSettingsStore((s) => s.vaultName);
  const [showCmdPalette, setShowCmdPalette] = useState(false);

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
        <span className="font-medium">{vaultName || "AI Second Brain"}</span>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TabManager />
        </div>
        <RightSidebar />
      </div>

      <StatusBar />

      {showCmdPalette && <CommandPalette onClose={() => setShowCmdPalette(false)} />}
    </div>
  );
}

function VaultPrompt() {
  const [loading, setLoading] = useState(false);
  const openVault = useSettingsStore((s) => s.openVault);

  const handleOpenVault = async () => {
    try {
      setLoading(true);
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择知识库文件夹",
      });
      if (selected && typeof selected === "string") {
        // Notify backend to initialize the vault
        await api.vaults.open(selected);
        // Extract folder name from path
        const name = selected.split(/[/\\]/).filter(Boolean).pop() || "知识库";
        openVault(selected, name);
      }
    } catch (e) {
      console.error("Failed to open folder dialog:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold">AI Second Brain</h1>
        <p className="text-zinc-500 dark:text-zinc-400">打开一个知识库开始使用</p>
        <button
          className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          onClick={handleOpenVault}
          disabled={loading}
        >
          {loading ? "打开中..." : "打开知识库"}
        </button>
      </div>
    </div>
  );
}
