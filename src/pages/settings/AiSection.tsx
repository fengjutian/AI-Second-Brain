import { FaSpinner } from "react-icons/fa6";
import { useSettingsStore, DEFAULT_AI_CONFIG, type AiConfig } from "@/stores/settingsStore";
import { useState, useCallback } from "react";

export function AiSection() {
  const aiConfig = useSettingsStore((s) => s.aiConfig);
  const saveAiConfig = useSettingsStore((s) => s.saveAiConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = useCallback(
    (patch: Partial<AiConfig>) => {
      saveAiConfig({ ...aiConfig, ...patch });
    },
    [aiConfig, saveAiConfig],
  );

  const handleSave = useCallback(
    async (updates: Partial<AiConfig>) => {
      setSaving(true);
      setSaved(false);
      try {
        saveAiConfig({ ...aiConfig, ...updates });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        console.error("Failed to save AI config:", e);
      } finally {
        setSaving(false);
      }
    },
    [aiConfig, saveAiConfig],
  );

  const handleReset = useCallback(() => {
    saveAiConfig({ ...DEFAULT_AI_CONFIG });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [saveAiConfig]);

  if (!aiConfig) return null;

  return (
    <div className="space-y-8">
      {/* ---- Embedding ---- */}
      <section>
        <h3 className="text-sm font-medium mb-3">Embedding 模型</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">提供者</span>
            <select
              value={aiConfig.embedding_provider}
              onChange={(e) => update({ embedding_provider: e.target.value })}
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
              onChange={(e) => update({ embedding_model: e.target.value.trim() || null })}
              placeholder={
                aiConfig.embedding_provider === "local" ? "all-MiniLM-L6-v2" : "text-embedding-3-small"
              }
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </label>
        </div>
      </section>

      {/* ---- LLM ---- */}
      <section>
        <h3 className="text-sm font-medium mb-3">LLM 对话模型</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">提供者</span>
            <select
              value={aiConfig.llm_provider}
              onChange={(e) => update({ llm_provider: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            >
              <option value="local">local (Ollama)</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">
              模型名称 <span className="text-zinc-400">（空 = 使用默认）</span>
            </span>
            <input
              type="text"
              value={aiConfig.llm_model || ""}
              onChange={(e) => update({ llm_model: e.target.value.trim() || null })}
              placeholder={
                aiConfig.llm_provider === "local" ? "qwen2.5:7b" :
                aiConfig.llm_provider === "deepseek" ? "deepseek-chat" :
                "gpt-4o-mini"
              }
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </label>

          {aiConfig.llm_provider === "local" && (
            <label className="block">
              <span className="text-xs text-zinc-500 mb-1 block">Ollama 地址</span>
              <input
                type="text"
                value={aiConfig.ollama_base_url}
                onChange={(e) => update({ ollama_base_url: e.target.value })}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
            </label>
          )}

          {aiConfig.llm_provider === "deepseek" && (
            <label className="block">
              <span className="text-xs text-zinc-500 mb-1 block">DeepSeek 地址</span>
              <input
                type="text"
                value={aiConfig.deepseek_base_url}
                onChange={(e) => update({ deepseek_base_url: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
            </label>
          )}
        </div>
      </section>

      {/* ---- API Key ---- */}
      <section>
        <h3 className="text-sm font-medium mb-3">API Key</h3>
        {aiConfig.llm_provider === "local" && (
          <p className="text-xs text-zinc-400">本地模型无需 API Key</p>
        )}
        {aiConfig.llm_provider === "openai" && (
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">
              OpenAI API Key <span className="text-zinc-400">（必填）</span>
            </span>
            <input
              type="password"
              value={aiConfig.api_key_openai}
              onChange={(e) => update({ api_key_openai: e.target.value })}
              placeholder="sk-..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono"
            />
          </label>
        )}
        {aiConfig.llm_provider === "deepseek" && (
          <label className="block">
            <span className="text-xs text-zinc-500 mb-1 block">
              DeepSeek API Key <span className="text-zinc-400">（必填）</span>
            </span>
            <input
              type="password"
              value={aiConfig.api_key_deepseek}
              onChange={(e) => update({ api_key_deepseek: e.target.value })}
              placeholder="sk-..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono"
            />
          </label>
        )}
      </section>

      {/* ---- Actions ---- */}
      <div className="flex items-center gap-3 text-sm">
        {saving && (
          <span className="flex items-center gap-1 text-zinc-400">
            <FaSpinner size={14} className="animate-spin text-blue-500" />
            保存中...
          </span>
        )}
        {saved && <span className="text-green-600">✅ 已保存</span>}
        <div className="flex-1" />
        <button
          onClick={handleReset}
          className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
        >
          恢复默认
        </button>
      </div>
    </div>
  );
}
