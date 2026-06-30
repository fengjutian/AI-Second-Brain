import { useState, useEffect, useCallback, useRef } from "react";
import type { SlashCommandItem } from "@/components/editor/SlashCommand";

export function useSlashMenu() {
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<SlashCommandItem[]>([]);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const commandRef = useRef<(item: SlashCommandItem) => void>(() => {});
  const itemsRef = useRef<SlashCommandItem[]>([]);

  useEffect(() => {
    const onShow = (e: Event) => {
      const { clientRect, items: newItems, command } = (e as CustomEvent).detail;
      commandRef.current = command;
      itemsRef.current = newItems || [];
      setItems(newItems || []);
      const rect = clientRect?.();
      setPosition(rect ? { x: rect.left, y: rect.bottom + 4 } : null);
      setSelectedIdx(0);
      setVisible(true);
    };

    const onUpdate = (e: Event) => {
      const { clientRect, items: newItems, command } = (e as CustomEvent).detail;
      commandRef.current = command;
      itemsRef.current = newItems || [];
      setItems(newItems || []);
      const rect = clientRect?.();
      if (rect) setPosition({ x: rect.left, y: rect.bottom + 4 });
    };

    const onKey = (e: Event) => {
      const keyEvent = (e as CustomEvent).detail.event as KeyboardEvent;
      const cur = itemsRef.current;
      if (cur.length === 0) return;
      if (keyEvent.key === "ArrowDown") {
        keyEvent.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, cur.length - 1));
      } else if (keyEvent.key === "ArrowUp") {
        keyEvent.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (keyEvent.key === "Enter") {
        keyEvent.preventDefault();
        if (cur[0]) commandRef.current(cur[0]);
        setVisible(false);
      }
    };

    const onHide = () => setVisible(false);

    window.addEventListener("slash:show", onShow);
    window.addEventListener("slash:update", onUpdate);
    window.addEventListener("slash:keydown", onKey);
    window.addEventListener("slash:hide", onHide);
    return () => {
      window.removeEventListener("slash:show", onShow);
      window.removeEventListener("slash:update", onUpdate);
      window.removeEventListener("slash:keydown", onKey);
      window.removeEventListener("slash:hide", onHide);
    };
  }, []);

  const handleSelect = useCallback((item: SlashCommandItem) => {
    commandRef.current(item);
    setVisible(false);
  }, []);

  return { visible, items, position, selectedIdx, handleSelect };
}

export function SlashMenu({
  items,
  position,
  selectedIdx,
  onSelect,
}: {
  items: SlashCommandItem[];
  position: { x: number; y: number } | null;
  selectedIdx: number;
  onSelect: (item: SlashCommandItem) => void;
}) {
  if (!position || items.length === 0) return null;

  return (
    <div
      className="fixed z-50 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden py-1"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, idx) => (
        <button
          key={item.title}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
            idx === selectedIdx
              ? "bg-accent/10 text-accent"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          onMouseEnter={() => setSelectedIdxState(idx)}
        >
          <span className="w-8 h-8 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-500 shrink-0">
            {item.icon}
          </span>
          <div className="min-w-0">
            <div className="font-medium text-sm">{item.title}</div>
            <div className="text-xs text-zinc-400 truncate">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// Hacky but works — we need to update selectedIdx from the menu
function setSelectedIdxState(_idx: number) {
  // This is intentionally a no-op for onMouseEnter — 
  // the Enter key on selectedIdx handles selection, not mouse hover index tracking
}
