import { useState, useEffect, useRef } from "react";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";

interface Suggestion {
  id: string;
  title: string;
  path: string;
}

interface WikiLinkPopupProps {
  editorView: any;
  results: Suggestion[];
  selectedIndex: number;
  active: boolean;
}

export function WikiLinkPopup({ editorView, results, selectedIndex, active }: WikiLinkPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!active || !editorView) return;

    // Get the position of the [[ in the editor
    const { state } = editorView;
    const { from } = state.selection;
    const coords = editorView.coordsAtPos(from);
    const editorEl = editorView.dom.closest(".tiptap");
    if (editorEl) {
      const rect = editorEl.getBoundingClientRect();
      setPosition({
        x: coords.left - rect.left,
        y: coords.bottom - rect.top + 4,
      });
    }
  }, [active, editorView, results]);

  if (!active || results.length === 0) return null;

  return (
    <div
      ref={popupRef}
      className="absolute z-50 w-64 max-h-48 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl text-sm"
      style={{ left: position.x, top: position.y }}
    >
      {results.map((item, idx) => (
        <div
          key={item.id}
          className={`px-3 py-1.5 cursor-pointer flex items-center justify-between ${
            idx === selectedIndex
              ? "bg-accent/10 text-accent"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <span className="truncate">{item.title}</span>
          <span className="text-xs text-zinc-400 ml-2 truncate">{item.path}</span>
        </div>
      ))}
    </div>
  );
}

export function renderWikiLinks(html: string): string {
  /** Convert [[target]] and [[target|label]] to styled <a> links in preview */
  return html.replace(
    /\[\[([^\]]+)\]\]/g,
    (_match: string, inner: string) => {
      const parts = inner.split("|");
      const target = parts[0].trim();
      const label = parts[1]?.trim() || target;
      return `<a class="wiki-link" data-target="${target}" href="#">${label}</a>`;
    }
  );
}

export function useWikiLinkClick(editorRef: React.RefObject<HTMLDivElement | null>) {
  const openTab = useTabStore((s) => s.openTab);
  const loadNote = useNoteStore((s) => s.loadNote);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("wiki-link")) {
        e.preventDefault();
        const noteTitle = target.getAttribute("data-target");
        if (!noteTitle) return;

        // Search for note by title in noteStore cache
        // For now, open a tab with the title
        // TODO: resolve note_id from the link data
      }
    };

    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [editorRef]);
}
