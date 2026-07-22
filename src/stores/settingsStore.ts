import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

export interface AiConfig {
  embedding_provider: string;
  embedding_model: string | null;
  llm_provider: string;
  llm_model: string | null;
  api_key_openai: string;
  api_key_deepseek: string;
  ollama_base_url: string;
  deepseek_base_url: string;
}

const STORAGE_KEY = "aiConfig";

function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_AI_CONFIG };
}

export function persistAiConfig(cfg: AiConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  embedding_provider: "local",
  embedding_model: null,
  llm_provider: "deepseek",
  llm_model: "deepseek-chat",
  api_key_openai: "",
  api_key_deepseek: "",
  ollama_base_url: "http://localhost:11434/v1",
  deepseek_base_url: "https://api.deepseek.com/v1",
};

export interface RecentVault {
  path: string;
  name: string;
  opened_at: string;
}

interface SettingsState {
  theme: Theme;
  vaultPath: string | null;
  vaultName: string | null;
  recentVaults: RecentVault[];
  aiConfig: AiConfig;
  aiConfigLoading: boolean;
  offlineMode: boolean;
  setTheme: (t: Theme) => void;
  openVault: (path: string, name: string) => void;
  setRecentVaults: (v: RecentVault[]) => void;
  removeRecentVault: (path: string) => void;
  setAiConfig: (c: AiConfig) => void;
  saveAiConfig: (c: AiConfig) => void;
  setAiConfigLoading: (v: boolean) => void;
  setOfflineMode: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: (localStorage.getItem("theme") as Theme) || "system",
  vaultPath: null,
  vaultName: null,
  recentVaults: [],
  aiConfig: loadAiConfig(),
  aiConfigLoading: false,
  offlineMode: localStorage.getItem("offlineMode") === "true",
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    set({ theme });
  },
  openVault: (vaultPath, vaultName) => set({ vaultPath, vaultName }),
  setRecentVaults: (recentVaults) => set({ recentVaults }),
  removeRecentVault: (path) =>
    set((s) => ({
      recentVaults: s.recentVaults.filter((v) => v.path !== path),
    })),
  setAiConfig: (aiConfig) => set({ aiConfig }),
  saveAiConfig: (aiConfig) => {
    persistAiConfig(aiConfig);
    set({ aiConfig });
  },
  setAiConfigLoading: (aiConfigLoading) => set({ aiConfigLoading }),
  setOfflineMode: (offlineMode) => {
    localStorage.setItem("offlineMode", String(offlineMode));
    set({ offlineMode });
  },
}));
