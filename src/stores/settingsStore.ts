import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

export interface AiConfig {
  embedding_provider: string;
  embedding_model: string | null;
  llm_provider: string;
  llm_model: string | null;
  api_key_openai: string;
  ollama_base_url: string;
}

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
  aiConfig: AiConfig | null;
  aiConfigLoading: boolean;
  offlineMode: boolean;
  setTheme: (t: Theme) => void;
  openVault: (path: string, name: string) => void;
  setRecentVaults: (v: RecentVault[]) => void;
  removeRecentVault: (path: string) => void;
  setAiConfig: (c: AiConfig) => void;
  setAiConfigLoading: (v: boolean) => void;
  setOfflineMode: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: (localStorage.getItem("theme") as Theme) || "system",
  vaultPath: null,
  vaultName: null,
  recentVaults: [],
  aiConfig: null,
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
  setAiConfigLoading: (aiConfigLoading) => set({ aiConfigLoading }),
  setOfflineMode: (offlineMode) => {
    localStorage.setItem("offlineMode", String(offlineMode));
    set({ offlineMode });
  },
}));
