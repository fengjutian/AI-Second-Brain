import { FaSpinner } from "react-icons/fa6";
import { useSettingsStore, DEFAULT_AI_CONFIG, type AiConfig } from "@/stores/settingsStore";
import { api } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";

export function AiSection() {
  const aiConfig = useSettingsStore((s) => s.aiConfig);
  const setAiConfig = useSettingsStore((s) => s.setAiConfig);
  const loading = useSettingsStore((s) => s.aiConfigLoading);
  const setLoading = useSettingsStore((s) => s.setAiConfigLoading);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.config.ai
      .get()
      .then((cfg) => setAiConfig(cfg))
      .catch(() => {
        // API unavailable — use local defaults
        setAiConfig(DEFAULT_AI_CONFIG);
      })
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
              onChange={(e) => {
                const v = e.target.value.trim();
                setAiConfig({ ...aiConfig, llm_model: v || null });
              }}
              onBlur={() => handleSave({ llm_model: aiConfig.llm_model })}
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
                onChange={(e) => setAiConfig({ ...aiConfig, ollama_base_url: e.target.value })}
                onBlur={() => handleSave({ ollama_base_url: aiConfig.ollama_base_url })}
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
                onChange={(e) => setAiConfig({ ...aiConfig, deepseek_base_url: e.target.value })}
                onBlur={() => handleSave({ deepseek_base_url: aiConfig.deepseek_base_url })}
                placeholder="https://api.deepseek.com/v1"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
            </label>
          )}
        </div>
      </section>

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
              onChange={(e) => setAiConfig({ ...aiConfig, api_key_openai: e.target.value })}
              onBlur={() => handleSave({ api_key_openai: aiConfig.api_key_openai })}
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
              onChange={(e) => setAiConfig({ ...aiConfig, api_key_deepseek: e.target.value })}
              onBlur={() => handleSave({ api_key_deepseek: aiConfig.api_key_deepseek })}
              placeholder="sk-..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono"
            />
          </label>
        )}
      </section>

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
