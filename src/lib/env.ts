/** Detect whether we're running inside Tauri or a regular browser. */

// Use Tauri's documented detection: window.__TAURI_INTERNALS__ is set by the Tauri webview
export const isTauri = (): boolean => {
  return !!(window as any).__TAURI_INTERNALS__;
};

export const isBrowser = (): boolean => !isTauri();
