/** Markdown Format Plugin — keyboard shortcuts for formatting. */
import type { Plugin, PluginContext } from "@/lib/plugin-api";

export const MarkdownFormatPlugin: Plugin = {
  manifest: {
    id: "markdown-format",
    name: "Markdown 格式化",
    version: "1.0.0",
    description: "提供 Markdown 格式化快捷键（加粗/斜体/列表等）",
    author: "AI Second Brain",
    minAppVersion: "0.3.0",
  },

  activate(context: PluginContext) {
    const formatCommands = [
      {
        id: "bold",
        name: "加粗选中文本",
        hotkey: "Ctrl+B",
        callback: () => {
          document.execCommand("bold");
        },
      },
      {
        id: "italic",
        name: "斜体选中文本",
        hotkey: "Ctrl+I",
        callback: () => {
          document.execCommand("italic");
        },
      },
      {
        id: "heading-1",
        name: "设为一级标题",
        callback: () => {
          wrapSelectedLine("# ");
        },
      },
      {
        id: "heading-2",
        name: "设为二级标题",
        callback: () => {
          wrapSelectedLine("## ");
        },
      },
      {
        id: "heading-3",
        name: "设为三级标题",
        callback: () => {
          wrapSelectedLine("### ");
        },
      },
      {
        id: "bullet-list",
        name: "切换无序列表",
        callback: () => {
          wrapSelectedLine("- ");
        },
      },
      {
        id: "numbered-list",
        name: "切换有序列表",
        callback: () => {
          wrapSelectedLine("1. ");
        },
      },
      {
        id: "blockquote",
        name: "切换引用块",
        callback: () => {
          wrapSelectedLine("> ");
        },
      },
    ];

    for (const cmd of formatCommands) {
      context.addCommand(cmd);
    }
  },

  deactivate() {
    // Clean up
  },
};

function wrapSelectedLine(prefix: string) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const startNode = range.startContainer;

  if (startNode.nodeType === Node.TEXT_NODE && startNode.parentElement?.closest(".tiptap")) {
    // Toggle prefix
    const text = startNode.textContent || "";
    const offset = range.startOffset;

    // Find start of line
    let lineStart = offset;
    while (lineStart > 0 && text[lineStart - 1] !== "\n") lineStart--;

    const line = text.slice(lineStart, offset + (range.endOffset - range.startOffset));
    if (line.startsWith(prefix)) {
      // Remove prefix
      const newText = text.slice(0, lineStart) + line.slice(prefix.length) + text.slice(lineStart + line.length);
      (startNode as Text).textContent = newText;
    } else {
      // Add prefix
      const newText = text.slice(0, lineStart) + prefix + line + text.slice(lineStart + line.length);
      (startNode as Text).textContent = newText;
    }
  }
}
