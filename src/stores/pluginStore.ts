/** Plugin state management — loaded plugins, enabled/disabled, lifecycle. */
import { create } from "zustand";
import type { Plugin, PluginManifest, PluginContext, Command, SettingTab, AppEvent } from "@/lib/plugin-api";

interface PluginEntry {
  manifest: PluginManifest;
  instance: Plugin;
  enabled: boolean;
  source: "core" | "community" | "dev";
  path: string; // relative path in plugins/
}

interface PluginState {
  plugins: PluginEntry[];
  loaded: boolean;

  /** Load all plugins from plugins/ directory */
  loadPlugins: (vaultPath: string) => Promise<void>;

  /** Enable/disable a plugin */
  setEnabled: (id: string, enabled: boolean) => Promise<void>;

  /** Activate all enabled plugins */
  activateAll: () => Promise<void>;

  /** Deactivate all plugins */
  deactivateAll: () => Promise<void>;

  /** Dispatch an app event to all plugins */
  dispatchEvent: (event: AppEvent, data?: any) => void;

  /** Register a core (built-in) plugin */
  registerCorePlugin: (plugin: Plugin) => void;
}

// Global state that plugins can mutate
const commands: Command[] = [];
const ribbonIcons: Array<{ el: HTMLElement; id: string }> = [];
const statusBarItems: HTMLElement[] = [];
const settingTabs: SettingTab[] = [];
const editorExtensions: any[] = [];
const eventHandlers: Map<AppEvent, Array<(data?: any) => void>> = new Map();

export function getRegisteredCommands(): Command[] {
  return commands;
}

export function getEditorExtensions(): any[] {
  return editorExtensions;
}

export function getSettingTabs(): SettingTab[] {
  return settingTabs;
}

/** Reset all module-level plugin state (called on vault switch). */
function clearPluginState() {
  commands.length = 0;
  ribbonIcons.length = 0;
  statusBarItems.length = 0;
  settingTabs.length = 0;
  editorExtensions.length = 0;
  eventHandlers.clear();
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  loaded: false,

  registerCorePlugin: (plugin) => {
    const entry: PluginEntry = {
      manifest: plugin.manifest,
      instance: plugin,
      enabled: true,
      source: "core",
      path: `core/${plugin.manifest.id}`,
    };
    set((s) => ({ plugins: [...s.plugins, entry] }));
  },

  loadPlugins: async (_vaultPath) => {
    // Clear previous
    await get().deactivateAll();
    clearPluginState();

    set({ plugins: [], loaded: false });

    // Scan plugins/ directory
    // Scan plugins/ directory
    try {
      // In production, we'd scan the directory. For now, load from a list.
      // Plugins are registered via registerCorePlugin() or dynamically.
    } catch {
      // No plugins directory
    }

    set({ loaded: true });
  },

  activateAll: async () => {
    const { plugins } = get();
    for (const entry of plugins) {
      if (!entry.enabled) continue;
      try {
        const ctx = createPluginContext(entry.manifest.id);
        await entry.instance.activate(ctx);
        console.log(`[plugin] Activated: ${entry.manifest.id}`);
      } catch (e) {
        console.error(`[plugin] Failed to activate ${entry.manifest.id}:`, e);
      }
    }
  },

  deactivateAll: async () => {
    const { plugins } = get();
    for (const entry of plugins) {
      try {
        await entry.instance.deactivate();
      } catch (e) {
        console.error(`[plugin] Failed to deactivate ${entry.manifest.id}:`, e);
      }
    }
  },

  setEnabled: async (id, enabled) => {
    const { plugins } = get();
    const entry = plugins.find((p) => p.manifest.id === id);
    if (!entry) return;

    if (enabled && !entry.enabled) {
      const ctx = createPluginContext(id);
      await entry.instance.activate(ctx);
    } else if (!enabled && entry.enabled) {
      await entry.instance.deactivate();
    }

    set((s) => ({
      plugins: s.plugins.map((p) =>
        p.manifest.id === id ? { ...p, enabled } : p
      ),
    }));
  },

  dispatchEvent: (event, data) => {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      for (const fn of handlers) fn(data);
    }
  },
}));

function createPluginContext(pluginId: string): PluginContext {
  return {
    pluginId,

    addCommand: (cmd) => {
      commands.push({ ...cmd, id: `${pluginId}:${cmd.id}` });
    },

    addRibbonIcon: (icon, title, onClick) => {
      const el = document.createElement("div");
      el.className = "ribbon-icon";
      el.title = title;
      el.onclick = onClick;
      el.textContent = icon;
      ribbonIcons.push({ el, id: pluginId });
      return el;
    },

    addStatusBarItem: () => {
      const el = document.createElement("span");
      statusBarItems.push(el);
      return el;
    },

    addSettingTab: (tab) => {
      settingTabs.push({ ...tab, id: `${pluginId}:${tab.id}` });
    },

    addEditorExtension: (ext) => {
      editorExtensions.push(ext);
    },

    onEvent: (event, callback) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event)!.push(callback);
    },
  };
}
