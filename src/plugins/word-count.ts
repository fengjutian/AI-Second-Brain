/** Word Count Plugin — shows word/character count in status bar. */
import type { Plugin, PluginContext } from "@/lib/plugin-api";
import { useNoteStore } from "@/stores/noteStore";

function countStats(content: string): { words: number; chars: number } {
  const words = content.split(/\s+/).filter(Boolean).length;
  const chars = content.replace(/\s/g, "").length;
  return { words, chars };
}

let unsubscribe: (() => void) | null = null;

export const WordCountPlugin: Plugin = {
  manifest: {
    id: "word-count",
    name: "字数统计",
    version: "1.0.0",
    description: "在状态栏显示当前笔记的字数和字符数",
    author: "Rainstone",
    minAppVersion: "0.3.0",
  },

  activate(context: PluginContext) {
    const el = context.addStatusBarItem();
    el.className = "text-xs text-zinc-500 dark:text-zinc-400 px-2";
    el.textContent = "0 词 | 0 字";

    // Subscribe to note store to track the active note's content
    unsubscribe = useNoteStore.subscribe((state, prev) => {
      const currentId = state.currentId;
      if (!currentId) {
        el.textContent = "0 词 | 0 字";
        return;
      }

      const note = state.notes.get(currentId);
      if (!note) {
        el.textContent = "0 词 | 0 字";
        return;
      }

      // Only update if content or current note changed
      const prevNote = prev.notes.get(prev.currentId || "");
      if (
        currentId !== prev.currentId ||
        (prevNote && note.content !== prevNote.content)
      ) {
        const { words, chars } = countStats(note.content);
        el.textContent = `${words} 词 | ${chars} 字`;
      }
    });
  },

  deactivate() {
    unsubscribe?.();
    unsubscribe = null;
  },
};
