/**
 * AiPopup — Floating AI instruction panel for the editor.
 *
 * Shows a text input to type an AI instruction (e.g. "Make this more formal"),
 * displays streaming progress, and provides Accept/Reject buttons.
 */

import { useState, useRef, useEffect } from "react";
import { FaWandMagicSparkles, FaCheck, FaXmark, FaSpinner } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export interface AiPopupProps {
  /** Current AI status */
  status: "idle" | "streaming" | "done" | "error";
  /** The accumulated result text (streaming or final) */
  result: string;
  /** Error message if status === "error" */
  error: string;
  /** Call with the user's instruction */
  onSubmit: (instruction: string) => void;
  /** Accept all pending tracked changes */
  onAccept: () => void;
  /** Reject all pending tracked changes */
  onReject: () => void;
  /** Cancel the current operation */
  onCancel: () => void;
  /** Dismiss the popup */
  onDismiss: () => void;
  /** Optional placeholder for the instruction input */
  placeholder?: string;
  /** Whether the popup is visible */
  visible: boolean;
}

export function AiPopup({
  status,
  result,
  error,
  onSubmit,
  onAccept,
  onReject,
  onCancel,
  onDismiss,
  placeholder = "输入 AI 指令，如：\"变得更正式\"、\"翻译为英文\"、\"缩短\"",
  visible,
}: AiPopupProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [visible]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    onSubmit(trimmed);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[520px] max-w-[calc(100vw-2rem)]">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl p-3 animate-slide-up">
        {status === "idle" && (
          <div className="flex items-center gap-2">
            <FaWandMagicSparkles size={16} className="text-accent shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") onDismiss();
              }}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-2.5 py-1 text-xs rounded-md bg-accent text-white disabled:opacity-40 transition-opacity"
            >
              发送
            </button>
            <button onClick={onDismiss} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              <FaXmark size={14} />
            </button>
          </div>
        )}

        {status === "streaming" && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FaSpinner size={14} className="text-accent animate-spin" />
              <span className="text-xs text-zinc-500">AI 正在生成…</span>
              <div className="flex-1" />
              <button onClick={onCancel} className="text-xs text-zinc-400 hover:text-zinc-600">
                取消
              </button>
            </div>
            {result && (
              <div className="max-h-32 overflow-y-auto text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 whitespace-pre-wrap">
                {result}
              </div>
            )}
          </div>
        )}

        {status === "done" && (
          <div className="flex items-center gap-2">
            <FaCheck size={14} className="text-green-500" />
            <span className="text-xs text-zinc-500">AI 编辑已应用为建议</span>
            <div className="flex-1" />
            <button
              onClick={onAccept}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors",
                "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
                "hover:bg-green-200 dark:hover:bg-green-900/50",
              )}
            >
              <FaCheck size={10} /> 全部接受
            </button>
            <button
              onClick={onReject}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors",
                "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
                "hover:bg-red-200 dark:hover:bg-red-900/50",
              )}
            >
              <FaXmark size={10} /> 全部拒绝
            </button>
            <button onClick={onDismiss} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              <FaXmark size={14} />
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-500">{error || "AI 请求失败"}</span>
            <div className="flex-1" />
            <button onClick={onDismiss} className="text-xs text-zinc-400 hover:text-zinc-600">
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
