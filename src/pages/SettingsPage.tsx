import {
  FaArrowLeft, FaSun, FaMoon, FaDisplay, FaUpload, FaSpinner, FaPuzzlePiece, FaPowerOff,
  FaBrain, FaFolderOpen, FaTrashCan, FaGear, FaBox, FaDownload,
} from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { useSettingsStore, type Theme, type AiConfig } from "@/stores/settingsStore";
import { usePluginStore } from "@/stores/pluginStore";
import { cn } from "@/lib/utils";
import { InputDialog } from "@/components/ui/InputDialog";
import { api } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

// ---- Constants ----

const themes: { id: Theme; label: string; icon: typeof FaSun }[] = [
  { id: "light", label: "浅色", icon: FaSun },
  { id: "dark", label: "深色", icon: FaMoon },
  { id: "system", label: "跟随系统", icon: FaDisplay },
];

const TABS = [
  { id: "general", label: "常规", icon: FaGear },
  { id: "ai", label: "AI 设置", icon: FaBrain },
  { id: "plugins", label: "插件", icon: FaBox },
  { id: "import", label: "导入", icon: FaDownload },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ---- Page ----

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center px-4 gap-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
        <button onClick={() => navigate("/")} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <FaArrowLeft size={18} className="text-zinc-400" />
        </button>
        <span className="font-medium">设置</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-8 space-y-8 overflow-y-auto">
        {activeTab === "general" && <GeneralSection />}
        {activeTab === "ai" && <AiSection />}
        {activeTab === "plugins" && (
          <section>
            <h3 className="text-sm font-medium mb-3">插件</h3>
            <PluginSection />
          </section>
        )}
        {activeTab === "import" && (
          <section>
            <h3 className="text-sm font-medium mb-3">导入</h3>
            <ImportSection />
          </section>
        )}
      </div>
    </div>
  );
}

// ---- General Section: Theme + Vault ----

function GeneralSection() {
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

  // Load recent vaults
  useEffect(() => {
    api.vaults.recent().then((d) => setRecentVaults(d.recent || [])).catch(() => {});
  }, [setRecentVaults]);

  const handleOpenVault = useCallback(async () => {
    try {
      setOpening(true);
      const selected = await open({ directory: true, multiple: false, title: "选择知识库文件夹" });
      if (selected && typeof selected === "string") {
        const res = await api.vaults.open(selected);
        const name = selected.split(/[/\\]/).filter(Boolean).pop() || "知识库";
        openVault(selected, name);
        // Refresh recent list
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

      {/* Current Vault */}
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

      {/* Recent Vaults */}
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

      {/* Offline Mode */}
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

      {/* About */}
      <section>
        <h3 className="text-sm font-medium mb-3">关于</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Rainstone v0.1.0</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Tauri + React + FastAPI</p>
      </section>
    </div>
  );
}

// ---- AI Section ----

function AiSection() {
  const aiConfig = useSettingsStore((s) => s.aiConfig);
  const setAiConfig = useSettingsStore((s) => s.setAiConfig);
  const loading = useSettingsStore((s) => s.aiConfigLoading);
  const setLoading = useSettingsStore((s) => s.setAiConfigLoading);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load AI config on mount
  useEffect(() => {
    setLoading(true);
    api.config.ai
      .get()
      .then((cfg) => setAiConfig(cfg))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setAiConfig, setLoading]);

  const handleSave = useCallback(async (updates: Partial<AiConfig>) => {
    if (!aiConfig) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.config.ai.set(updates);
      setAiConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save AI config:", e);
    } finally {
      setSaving(false);
    }
  }, [aiConfig, setAiConfig]);

  if (loading || !aiConfig) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <FaSpinner size={16} className="animate-spin text-blue-500" />
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Embedding */}
      <section>
        <h3 className="text-sm font-medium mb-3">Embedding 模型</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">提供者</span>
            <select
              value={aiConfig.embedding_provider}
              onChange={(e) => handleSave({ embedding_provider: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              <option value="local">local (sentence-transformers)</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">
              模型名称 <span className="text-zinc-400">（空 = 使用默认）</span>
            </span>
            <input
              type="text"
              value={aiConfig.embedding_model || ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                setAiConfig({ ...aiConfig, embedding_model: v || null });
              }}
              onBlur={() => handleSave({ embedding_model: aiConfig.embedding_model })}
              placeholder={aiConfig.embedding_provider === "local" ? "all-MiniLM-L6-v2" : "text-embedding-3-small"}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </label>
        </div>
      </section>

      {/* LLM */}
      <section>
        <h3 className="text-sm font-medium mb-3">LLM 对话模型</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">提供者</span>
            <select
              value={aiConfig.llm_provider}
              onChange={(e) => handleSave({ llm_provider: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              <option value="local">local (Ollama)</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">
              模型名称 <span className="text-zinc-400">（空 = 使用默认）</span>
            </span>
            <input
              type="text"
              value={aiConfig.llm_model || ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                setAiConfig({ ...aiConfig, llm_model: v || null });
              }}
              onBlur={() => handleSave({ llm_model: aiConfig.llm_model })}
              placeholder={aiConfig.llm_provider === "local" ? "qwen2.5:7b" : "gpt-4o-mini"}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </label>
          {aiConfig.llm_provider === "local" && (
            <label className="block">
              <span className="text-xs text-zinc-500 mb-1 block">Ollama 地址</span>
              <input
                type="text"
                value={aiConfig.ollama_base_url}
                onChange={(e) => setAiConfig({ ...aiConfig, ollama_base_url: e.target.value })}
                onBlur={() => handleSave({ ollama_base_url: aiConfig.ollama_base_url })}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
            </label>
          )}
        </div>
      </section>

      {/* API Key */}
      <section>
        <h3 className="text-sm font-medium mb-3">API Key</h3>
        <label className="block">
          <span className="text-xs text-zinc-500 mb-1 block">
            OpenAI API Key <span className="text-zinc-400">（使用 OpenAI 时必填）</span>
          </span>
          <input
            type="password"
            value={aiConfig.api_key_openai}
            onChange={(e) => setAiConfig({ ...aiConfig, api_key_openai: e.target.value })}
            onBlur={() => handleSave({ api_key_openai: aiConfig.api_key_openai })}
            placeholder="sk-..."
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono"
          />
        </label>
      </section>

      {/* Save indicator */}
      <div className="flex items-center gap-2 text-sm">
        {saving && (
          <span className="flex items-center gap-1 text-zinc-400">
            <FaSpinner size={14} className="animate-spin text-blue-500" />
            保存中...
          </span>
        )}
        {saved && <span className="text-green-600">✅ 已保存</span>}
      </div>
    </div>
  );
}

// ---- Plugin Section ----

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

// ---- Import Section ----

function ImportSection() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = async (path: string) => {
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
        onClick={() => setImportOpen(true)}
        disabled={importing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {importing ? <FaSpinner size={16} className="animate-spin text-blue-500" /> : <FaUpload size={16} className="text-accent" />}
        导入 Obsidian 仓库
      </button>
      {result && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{result}</p>
      )}
      <InputDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入 Obsidian 仓库"
        placeholder="请输入 Obsidian 仓库的路径"
        confirmLabel="导入"
        onConfirm={handleImport}
      />
    </div>
  );
}
