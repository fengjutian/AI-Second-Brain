import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { isTauri } from "@/lib/env";
import { searchNotes } from "@/lib/localIndex";
import { useSettingsStore } from "@/stores/settingsStore";
import { FaSpinner } from "react-icons/fa6";

interface HoverPreviewProps {
  target: string | null;
  position: { x: number; y: number } | null;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function HoverPreview({ target, position, onMouseEnter, onMouseLeave }: HoverPreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!target) {
      setContent(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        let match: { note_id?: string; id?: string; title: string } | undefined;

        if (isTauri()) {
          const vaultPath = useSettingsStore.getState().vaultPath;
          if (!vaultPath) return;
          const results = await searchNotes(vaultPath, target!);
          match = results.find(
            (r: any) => r.title.toLowerCase() === target.toLowerCase()
          );
        } else {
          const results = await api.search.keyword(target);
          match = results.find(
            (r: any) => r.title.toLowerCase() === target.toLowerCase()
          );
        }

        if (cancelled) return;
        if (!match) {
          setError(true);
          setLoading(false);
          return;
        }

        const noteId = (match as any).note_id || (match as any).id;
        if (!noteId) { if (!cancelled) { setError(true); setLoading(false); } return; }
        const note = await api.notes.get(noteId);
        if (cancelled) return;

        const text = stripMarkdown(note.content || "");
        setContent(text.slice(0, 400));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [target]);

  if (!target || !position) return null;

  return (
    <div
      className="fixed z-[100] max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl pointer-events-auto"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={() => onMouseEnter?.()}
      onMouseLeave={() => onMouseLeave?.()}
    >
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <span className="text-sm font-medium truncate">{target}</span>
        <span className="text-xs text-zinc-400 ml-2">预览</span>
      </div>
      <div className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 max-h-48 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 py-2">
            <FaSpinner size={14} className="animate-spin text-blue-500" />
            加载中...
          </div>
        )}
        {error && <span className="text-zinc-400">未找到相关笔记</span>}
        {content && <div className="whitespace-pre-wrap leading-relaxed">{content}</div>}
      </div>
    </div>
  );
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/!\[.*?\]\(.*?\)/g, "[图片]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
