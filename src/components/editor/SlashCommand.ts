import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export type SlashCommandItem = {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: any; range: { from: number; to: number } }) => void;
};

const items: SlashCommandItem[] = [
  {
    title: "一级标题",
    description: "大号章节标题",
    icon: "H1",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "二级标题",
    description: "中等章节标题",
    icon: "H2",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "三级标题",
    description: "小型章节标题",
    icon: "H3",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: "无序列表",
    description: "子弹列表",
    icon: "•",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "有序列表",
    description: "编号列表",
    icon: "1.",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "引用",
    description: "引用文字",
    icon: "❝",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "代码块",
    description: "代码片段",
    icon: "</>",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "分割线",
    description: "视觉分隔",
    icon: "—",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "普通文本",
    description: "重置为段落",
    icon: "¶",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
];

export const slashCommandPluginKey = new PluginKey("slash-command");

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        pluginKey: slashCommandPluginKey,
        command: ({ editor, range, props }) => {
          (props as SlashCommandItem).command({ editor, range });
        },
        items: ({ query }) => {
          const q = query.toLowerCase();
          return items.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q)
          );
        },
        render: () => {
          const emit = (type: string, detail: Record<string, unknown> = {}) => {
            window.dispatchEvent(new CustomEvent(`slash:${type}`, { detail }));
          };

          return {
            onStart: (props: any) => {
              emit("show", {
                clientRect: props.clientRect,
                items: props.items,
                command: props.command,
              });
            },
            onUpdate: (props: any) => {
              emit("update", {
                clientRect: props.clientRect,
                items: props.items,
                command: props.command,
              });
            },
            onKeyDown: (props: any) => {
              if (props.event.key === "Escape") {
                // Let TipTap handle Escape naturally
                return true;
              }
              emit("keydown", { event: props.event });
              return false;
            },
            onExit: () => {
              emit("hide");
            },
          };
        },
      } as Partial<SuggestionOptions>),
    ];
  },
});

export { items };
