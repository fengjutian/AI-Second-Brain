/** Plugin API — interfaces and context for plugin development. */

// ---- Plugin Manifest ----
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  minAppVersion: string;
}

// ---- Plugin Context (injected into activate) ----
export interface PluginContext {
  /** Unique plugin id */
  pluginId: string;

  /** Register a command in the command palette */
  addCommand(command: Command): void;

  /** Add an icon button to the left ribbon */
  addRibbonIcon(icon: string, title: string, onClick: () => void): HTMLElement;

  /** Add an item to the status bar */
  addStatusBarItem(): HTMLElement;

  /** Register a settings tab */
  addSettingTab(tab: SettingTab): void;

  /** Register a TipTap editor extension */
  addEditorExtension(extension: any): void;

  /** Subscribe to lifecycle events */
  onEvent(event: AppEvent, callback: (data?: any) => void): void;
}

export interface Command {
  id: string;
  name: string;
  callback: () => void;
  hotkey?: string;
}

export interface SettingTab {
  id: string;
  name: string;
  icon?: string;
  render: (container: HTMLElement) => void;
}

export type AppEvent =
  | "vault-opened"
  | "vault-closed"
  | "note-created"
  | "note-updated"
  | "note-deleted"
  | "note-opened"
  | "editor-ready";

// ---- Plugin Interface ----
export interface Plugin {
  manifest: PluginManifest;
  activate(context: PluginContext): Promise<void> | void;
  deactivate(): Promise<void> | void;
}
