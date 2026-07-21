/**
 * Streaming AI chat client.
 *
 * Matches the backend SSE endpoint: POST /api/v1/chat/stream
 * Expects `{ messages: [{ role, content }] }` and streams back
 * `data: <chunk>\n\n` terminated by `data: [DONE]\n\n`.
 */
import { useSettingsStore } from "@/stores/settingsStore";

const BASE = "/api/v1";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Stream AI response from the backend.
 *
 * @param messages  The conversation messages to send
 * @param onChunk   Called with each text chunk as it arrives
 * @param signal    Optional AbortSignal for cancellation
 * @returns         The full accumulated response text
 */
export async function aiStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { offlineMode } = useSettingsStore.getState();
  if (offlineMode) throw new Error("离线模式");

  const res = await fetch(`${BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => "Unknown error"));
  }

  if (!res.body) {
    throw new ApiError(0, "Response has no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames: "data: ...\n\n"
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || ""; // keep incomplete frame in buffer

    for (const part of parts) {
      const lines = part.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return fullResponse;
          }
          fullResponse += data;
          onChunk(data);
        }
      }
    }
  }

  return fullResponse;
}
