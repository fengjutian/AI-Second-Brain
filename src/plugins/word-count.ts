/** Word Count Plugin — shows word/character count in status bar. */
import type { Plugin, PluginContext } from "@/lib/plugin-api";

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

    context.onEvent("note-opened", (data) => {
      if (data?.content) {
        const words = data.content.split(/\s+/).filter(Boolean).length;
        const chars = data.content.replace(/\s/g, "").length;
        el.textContent = `${words} 词 | ${chars} 字`;
      } else {
        el.textContent = "0 词 | 0 字";
      }
    });

    // Listen for content changes via a debounced MutationObserver
    // (simplified — in production this would watch the editor)
  },

  deactivate() {
    // Clean up
  },
};
