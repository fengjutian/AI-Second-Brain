const BASE = "http://localhost:8710/api/v1";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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
  },
  search: {
    keyword: (q: string) => request<any[]>(`/search?q=${encodeURIComponent(q)}`),
    semantic: (q: string) => request<any[]>(`/search/semantic?q=${encodeURIComponent(q)}`),
  },
  chat: {
    send: (messages: { role: string; content: string }[]) =>
      request<any>("/chat", { method: "POST", body: JSON.stringify({ messages }) }),
  },
  graph: {
    global: () => request<any>("/graph"),
    local: (id: string, depth = 1) => request<any>(`/graph/${id}/local?depth=${depth}`),
  },
};

export { ApiError };
