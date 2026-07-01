/** Markdown Format Plugin — keyboard shortcuts for formatting.
 *
 * NOTE: bold/italic are handled natively by TipTap StarterKit (Ctrl+B, Ctrl+I).
 * Block formatting (heading/list/quote) is available via the BubbleMenu and BlockHandle.
 * This plugin registers CommandPalette entries for these actions, dispatching via
 * the editor:format custom event so the active Editor can apply them with TipTap's API.
 */
import type { Plugin, PluginContext } from "@/lib/plugin-api";

type FormatAction =
  | "toggleBold"
  | "toggleItalic"
  | "toggleH1"
  | "toggleH2"
  | "toggleH3"
  | "toggleBulletList"
  | "toggleOrderedList"
  | "toggleBlockquote";

function dispatchFormat(action: FormatAction) {
  window.dispatchEvent(
    new CustomEvent("editor:format", { detail: { action } })
  );
}

export const MarkdownFormatPlugin: Plugin = {
  manifest: {
    id: "markdown-format",
    name: "Markdown 格式化",
    version: "1.0.0",
    description: "提供 Markdown 格式化快捷键（加粗/斜体/列表等）",
    author: "Rainstone",
    minAppVersion: "0.3.0",
  },

  activate(context: PluginContext) {
    const formatCommands = [
      { id: "bold", name: "加粗选中文本", action: "toggleBold" as const },
      { id: "italic", name: "斜体选中文本", action: "toggleItalic" as const },
      { id: "heading-1", name: "设为一级标题", action: "toggleH1" as const },
      { id: "heading-2", name: "设为二级标题", action: "toggleH2" as const },
      { id: "heading-3", name: "设为三级标题", action: "toggleH3" as const },
      { id: "bullet-list", name: "切换无序列表", action: "toggleBulletList" as const },
      { id: "numbered-list", name: "切换有序列表", action: "toggleOrderedList" as const },
      { id: "blockquote", name: "切换引用块", action: "toggleBlockquote" as const },
    ];

    for (const cmd of formatCommands) {
      context.addCommand({
        id: cmd.id,
        name: cmd.name,
        callback: () => dispatchFormat(cmd.action),
      });
    }
  },

  deactivate() {
    // Clean up
  },
};
