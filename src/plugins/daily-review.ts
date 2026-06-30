/** Daily Review Plugin — reminds you to review past notes. */
import type { Plugin, PluginContext } from "@/lib/plugin-api";

export const DailyReviewPlugin: Plugin = {
  manifest: {
    id: "daily-review",
    name: "每日回顾",
    version: "1.0.0",
    description: "随机推荐一篇旧笔记供回顾",
    author: "AI Second Brain",
    minAppVersion: "0.3.0",
  },

  activate(context: PluginContext) {
    context.addCommand({
      id: "open-random",
      name: "每日回顾：打开随机笔记",
      callback: async () => {
        const res = await fetch("http://localhost:8710/api/v1/notes");
        const notes = await res.json();
        if (notes.length > 0) {
          const random = notes[Math.floor(Math.random() * notes.length)];
          // Dispatch custom event to open note
          window.dispatchEvent(
            new CustomEvent("app:open-note", { detail: { id: random.id, title: random.title, path: random.path } })
          );
        }
      },
    });

    context.addRibbonIcon("🎲", "每日回顾", () => {
      context.addCommand({
        id: "open-random",
        name: "每日回顾：打开随机笔记",
        callback: async () => {
          const res = await fetch("http://localhost:8710/api/v1/notes");
          const notes = await res.json();
          if (notes.length > 0) {
            const random = notes[Math.floor(Math.random() * notes.length)];
            window.dispatchEvent(
              new CustomEvent("app:open-note", { detail: { id: random.id, title: random.title, path: random.path } })
            );
          }
        },
      });
    });
  },

  deactivate() {
    // Clean up
  },
};
