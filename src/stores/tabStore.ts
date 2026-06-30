import { create } from "zustand";

export interface Tab {
  id: string;           // unique tab id
  noteId: string;       // note id (or "new" for unsaved)
  title: string;
  path: string;
  isDirty: boolean;
  isPinned: boolean;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (tab: Omit<Tab, "id" | "isDirty" | "isPinned"> & { id?: string }) => string;
  closeTab: (tabId: string) => void;
  setActive: (tabId: string) => void;
  setDirty: (tabId: string, dirty: boolean) => void;
  updateTitle: (tabId: string, title: string) => void;
}

let tabCounter = 0;

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (tab) => {
    const existing = get().tabs.find((t) => t.noteId === tab.noteId);
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const id = tab.id || `tab-${++tabCounter}`;
    const newTab: Tab = {
      ...tab,
      id,
      isDirty: false,
      isPinned: false,
    };
    set((s) => ({
      tabs: [...s.tabs, newTab],
      activeTabId: id,
    }));
    return id;
  },

  closeTab: (tabId) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === tabId);
      const next = s.tabs.filter((t) => t.id !== tabId);
      let nextActive = s.activeTabId;
      if (s.activeTabId === tabId) {
        if (next.length === 0) nextActive = null;
        else nextActive = next[Math.min(idx, next.length - 1)].id;
      }
      return { tabs: next, activeTabId: nextActive };
    });
  },

  setActive: (tabId) => set({ activeTabId: tabId }),

  setDirty: (tabId, dirty) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, isDirty: dirty } : t)),
    })),

  updateTitle: (tabId, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
    })),
}));
