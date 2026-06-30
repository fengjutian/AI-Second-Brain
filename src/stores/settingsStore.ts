import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  vaultPath: string | null;
  vaultName: string | null;
  setTheme: (t: Theme) => void;
  openVault: (path: string, name: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: (localStorage.getItem("theme") as Theme) || "system",
  vaultPath: null,
  vaultName: null,
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    set({ theme });
  },
  openVault: (vaultPath, vaultName) => set({ vaultPath, vaultName }),
}));
