import { useSettingsStore } from "@/stores/settingsStore";

const BASE = "/api/v1";

export class OfflineError extends Error {
  constructor() {
    super("应用处于离线模式");
    this.name = "OfflineError";
  }
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (useSettingsStore.getState().offlineMode) {
    throw new OfflineError();
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export const api = {
  notes: {
    list: (params?: Record<string, string>) =>
      request<any[]>(`/notes?${new URLSearchParams(params || {})}`),
    get: (id: string) => request<any>(`/notes/${id}`),
    create: (body: { path: string; template?: string }) =>
      request<any>("/notes", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { content: string }) =>
      request<any>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<void>(`/notes/${id}`, { method: "DELETE" }),
    outgoingLinks: (id: string) => request<any[]>(`/notes/${id}/links/outgoing`),
    backlinks: (id: string) => request<any[]>(`/notes/${id}/links/backlinks`),
  },
  search: {
    keyword: (q: string) => request<any[]>(`/search?q=${encodeURIComponent(q)}`),
    semantic: (q: string) => request<any[]>(`/search/semantic?q=${encodeURIComponent(q)}`),
  },
  chat: {
    send: (messages: { role: string; content: string }[]) =>
      request<any>("/chat", { method: "POST", body: JSON.stringify({ messages }) }),
  },
  daily: {
    today: () => request<any>("/daily/today"),
    get: (dateStr: string) => request<any>(`/daily/${dateStr}`),
  },
  graph: {
    global: () => request<any>("/graph"),
    local: (id: string, depth = 1) => request<any>(`/graph/${id}/local?depth=${depth}`),
  },
  vaults: {
    get: () => request<any>("/vaults"),
    open: (path: string) =>
      request<any>("/vaults/open", { method: "POST", body: JSON.stringify({ path }) }),
    recent: () => request<{ recent: any[] }>("/vaults/recent"),
    removeRecent: (path: string) =>
      request<void>(`/vaults/recent/${encodeURIComponent(path)}`, { method: "DELETE" }),
  },
  config: {
    ai: {
      get: () => request<any>("/config/ai"),
      set: (updates: Record<string, any>) =>
        request<any>("/config/ai", { method: "PUT", body: JSON.stringify(updates) }),
    },
  },
};

export { ApiError };
