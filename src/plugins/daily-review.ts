/** Daily Review Plugin — reminds you to review past notes. */
import type { Plugin, PluginContext } from "@/lib/plugin-api";
import { api } from "@/lib/api";

async function openRandomNote() {
  try {
    const notes = await api.notes.list();
    if (notes.length > 0) {
      const random = notes[Math.floor(Math.random() * notes.length)];
      window.dispatchEvent(
        new CustomEvent("app:open-note", { detail: { id: random.id, title: random.title, path: random.path } })
      );
    }
  } catch {
    // Backend not available — silently fail
  }
}

export const DailyReviewPlugin: Plugin = {
  manifest: {
    id: "daily-review",
    name: "每日回顾",
    version: "1.0.0",
    description: "随机推荐一篇旧笔记供回顾",
    author: "Rainstone",
    minAppVersion: "0.3.0",
  },

  activate(context: PluginContext) {
    context.addCommand({
      id: "open-random",
      name: "每日回顾：打开随机笔记",
      callback: openRandomNote,
    });

    context.addRibbonIcon("🎲", "每日回顾", () => {
      openRandomNote();
    });
  },

  deactivate() {
    // Clean up
  },
};
