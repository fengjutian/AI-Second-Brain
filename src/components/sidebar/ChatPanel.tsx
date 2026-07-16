import { useState, useRef, useCallback, useMemo } from "react";
import { Bubble, Sender, Conversations, Suggestion } from "@ant-design/x";
import { useSettingsStore } from "@/stores/settingsStore";
import { api } from "@/lib/api";
import { FaRobot, FaPlus, FaTrashCan } from "react-icons/fa6";

interface Message {
  key: string;
  role: "user" | "ai";
  content: string;
  status?: "loading" | "success" | "error";
}

interface Conversation {
  key: string;
  label: string;
  messages: Message[];
}

const SUGGESTIONS = [
  { label: "总结当前笔记", value: "请总结当前打开的笔记内容" },
  { label: "帮我写大纲", value: "帮我写一个关于「本地优先应用架构」的文章大纲" },
  { label: "解释代码", value: "请解释以下代码的功能和逻辑" },
  { label: "翻译为英文", value: "请将以下内容翻译为英文" },
];

function createWelcomeMsg(): Message {
  return {
    key: "welcome",
    role: "ai",
    content: "你好！我是你的 AI 助手。选择一个快捷提示，或直接输入你的问题。",
    status: "success",
  };
}

export function ChatPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([
    { key: "default", label: "新对话", messages: [createWelcomeMsg()] },
  ]);
  const [activeKey, setActiveKey] = useState("default");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<any>(null);
  const aiConfig = useSettingsStore((s) => s.aiConfig);

  const activeConv = useMemo(
    () => conversations.find((c) => c.key === activeKey) || conversations[0],
    [conversations, activeKey]
  );

  const handleNewConversation = useCallback(() => {
    const key = `conv_${Date.now()}`;
    const label = `对话 ${conversations.length + 1}`;
    setConversations((prev) => [...prev, { key, label, messages: [createWelcomeMsg()] }]);
    setActiveKey(key);
  }, [conversations.length]);

  const handleDeleteConversation = useCallback((key: string) => {
    if (conversations.length <= 1) return;
    setConversations((prev) => {
      const next = prev.filter((c) => c.key !== key);
      if (key === activeKey) setActiveKey(next[0]?.key || "default");
      return next;
    });
  }, [conversations, activeKey]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = { key: `user_${Date.now()}`, role: "user", content: text, status: "success" };
      const aiMsg: Message = { key: `ai_${Date.now()}`, role: "ai", content: "", status: "loading" };

      setConversations((prev) =>
        prev.map((c) =>
          c.key === activeKey
            ? { ...c, messages: [...c.messages, userMsg, aiMsg], label: text.slice(0, 20) }
            : c
        )
      );
      setLoading(true);

      try {
        const history = activeConv.messages
          .filter((m) => m.key !== "welcome" && m.status !== "error")
          .map((m) => ({ role: m.role, content: m.content }));
        const response = await api.chat.send(text, history);
        setConversations((prev) =>
          prev.map((c) =>
            c.key === activeKey
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.key === aiMsg.key ? { ...m, content: response, status: "success" } : m
                  ),
                }
              : c
          )
        );
      } catch {
        setConversations((prev) =>
          prev.map((c) =>
            c.key === activeKey
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.key === aiMsg.key
                      ? { ...m, content: "抱歉，AI 服务暂时不可用。请检查后端是否运行。", status: "error" }
                      : m
                  ),
                }
              : c
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [activeKey, activeConv.messages]
  );

  const handleSuggestionClick = useCallback(
    (value: string) => {
      handleSend(value);
    },
    [handleSend]
  );

  const conversationItems = conversations.map((c) => ({
    key: c.key,
    label: c.label,
  }));

  const showWelcome = activeConv.messages.length <= 1 && activeConv.messages[0]?.key === "welcome";

  return (
    <div className={`flex-1 flex min-w-0 animate-slide-in-right`}>
      {/* Sidebar: Conversations */}
      <div className="w-40 shrink-0 border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex flex-col">
        <div className="flex items-center justify-between px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
          <span className="text-[10px] font-medium text-zinc-500 uppercase">会话</span>
          <button
            onClick={handleNewConversation}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-accent"
            title="新对话"
          >
            <FaPlus size={10} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Conversations
            activeKey={activeKey}
            onActiveChange={setActiveKey}
            items={conversationItems}
            styles={{ item: { borderRadius: 6, margin: "2px 4px", padding: "4px 8px", fontSize: 11 } }}
          />
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950">
        {/* Header */}
        <div className="h-8 flex items-center gap-2 px-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <FaRobot size={14} className="text-accent" />
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 truncate">
            {activeConv.label}
          </span>
          {!aiConfig?.api_key_openai && (
            <span className="text-[10px] text-amber-500">未配置 API Key</span>
          )}
          <div className="flex-1" />
          {activeConv.messages.length > 1 && (
            <button
              onClick={() => handleDeleteConversation(activeKey)}
              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-500"
              title="删除对话"
            >
              <FaTrashCan size={10} />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <Bubble.List
            ref={listRef}
            items={activeConv.messages.map((m) => ({
              key: m.key,
              role: m.role === "ai" ? "ai" : "user",
              content: m.content,
              loading: m.status === "loading",
              variant: m.role === "ai" ? "filled" : "outlined",
            }))}
            style={{ gap: 8 }}
          />
        </div>

        {/* Suggestions */}
        {showWelcome && (
          <div className="px-3 pb-1">
            <Suggestion items={SUGGESTIONS} onSelect={handleSuggestionClick}>
              {(item: any) => (
                <span className="text-[11px] px-2 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-accent hover:text-accent cursor-pointer transition-colors">
                  {item.label}
                </span>
              )}
            </Suggestion>
          </div>
        )}

        {/* Input */}
        <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <Sender
            onSubmit={handleSend}
            loading={loading}
            placeholder={aiConfig?.api_key_openai ? "输入消息..." : "请先在设置中配置 API Key"}
            disabled={!aiConfig?.api_key_openai}
            style={{ borderRadius: 12 }}
          />
        </div>
      </div>
    </div>
  );
}
