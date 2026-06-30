import { useState, useRef, useEffect } from "react";
import { FaPaperPlane, FaRobot, FaUser, FaSpinner } from "react-icons/fa6";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const API_BASE = "/api/v1";

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreaming("");

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE: "data: ...\n\n"
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            full += data;
            setStreaming(full);
          }
        }
      }

      if (full) {
        setMessages((prev) => [...prev, { role: "assistant", content: full }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `AI 服务不可用：${err}` },
      ]);
    } finally {
      setLoading(false);
      setStreaming("");
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FaRobot size={16} className="text-accent" />
          AI 对话
        </div>
        <span className="text-xs text-zinc-400">RAG · 知识库问答</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-center text-sm text-zinc-400 py-8">
            <FaRobot size={32} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
            <p>向我提问，我会基于你的知识库回答</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              "flex gap-2 text-sm",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <FaRobot size={16} className="mt-0.5 shrink-0 text-accent" />
            )}
            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words",
                msg.role === "user"
                  ? "bg-accent text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              )}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <FaUser size={16} className="mt-0.5 shrink-0 text-zinc-400" />
            )}
          </div>
        ))}

        {/* Streaming indicator */}
        {streaming && (
          <div className="flex gap-2 text-sm">
            <FaRobot size={16} className="mt-0.5 shrink-0 text-accent" />
            <div className="rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap break-words bg-zinc-100 dark:bg-zinc-800">
              {streaming}
              <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="基于知识库提问..."
            disabled={loading}
            className="flex-1 px-3 py-1.5 text-sm rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-accent disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-3 py-1.5 bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {loading ? <FaSpinner size={16} className="animate-spin" /> : <FaPaperPlane size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
