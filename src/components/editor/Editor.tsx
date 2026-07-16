import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import ImageExtension from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { wikiLinkSuggestion } from "@/components/editor/WikiLink";
import { WikiLinkHighlight } from "@/components/editor/WikiLinkHighlight";
import { HoverPreview } from "@/components/editor/HoverPreview";
import { SlashCommand } from "@/components/editor/SlashCommand";
import { useSlashMenu, SlashMenu } from "@/components/editor/SlashMenu";
import { api } from "@/lib/api";
import { isTauri } from "@/lib/env";
import {
  FaBold, FaItalic, FaStrikethrough, FaCode, FaHeading, FaListUl, FaListOl, FaQuoteRight, FaParagraph, FaGripVertical, FaUnderline, FaLink,
  FaCircleInfo, FaTable, FaImage, FaListCheck, FaHighlighter, FaAlignLeft, FaAlignCenter, FaAlignRight,
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { Markdown } from "@tiptap/markdown";

const WikiLink = Mention.extend({
  renderText: ({ node }) => `[[${node.attrs.label ?? node.attrs.id}]]`,
  renderHTML: ({ node }) => [
    "span",
    { "data-type": "mention", "data-id": node.attrs.id, class: "wiki-link" },
    `[[${node.attrs.label ?? node.attrs.id}]]`,
  ],
  renderMarkdown: ({ node }) => `[[${node.attrs.label ?? node.attrs.id}]]`,
  markdownTokenizer: {
    name: "wikiLink",
    level: "inline",
    start: "[[",
    tokenize(src: string) {
      const match = /^\[\[([^\]]+?)\]\]/.exec(src);
      if (match) {
        return {
          type: "wikiLink",
          raw: match[0],
          text: match[1],
        };
      }
      return undefined;
    },
  },
  parseMarkdown: (token: { text?: string; raw?: string }) => {
    const label = token.text || token.raw?.slice(2, -2) || "";
    return {
      type: "mention",
      attrs: { id: label, label },
    };
  },
}).configure({
  suggestion: wikiLinkSuggestion,
  HTMLAttributes: {
    class: "wiki-link",
  },
});

interface EditorProps {
  tabId: string;
  noteId: string;
}

export function Editor({ tabId, noteId }: EditorProps) {
  const note = useNoteStore((s) => s.notes[noteId]);
  const setContent = useNoteStore((s) => s.setContent);
  const setDirty = useTabStore((s) => s.setDirty);
  const updateTitle = useTabStore((s) => s.updateTitle);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);
  const saveVersionRef = useRef(0); // prevents dirty-clean flicker during continuous typing
  const noteIdRef = useRef(noteId);
  const tabIdRef = useRef(tabId);
  noteIdRef.current = noteId;
  tabIdRef.current = tabId;
  const [showMeta, setShowMeta] = useState(false);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const previewHoveredRef = useRef(false);
  const hoverCallbacks = useRef<{ onHover: Function; onLeave: Function }>({
    onHover: () => {},
    onLeave: () => {},
  });

  hoverCallbacks.current = {
    onHover: (target: string, pos: { x: number; y: number }) => {
      setHoverTarget(target);
      setHoverPos(pos);
    },
    onLeave: () => {
      if (previewHoveredRef.current) return; // preview is being hovered — don't close
      setHoverTarget(null);
      setHoverPos(null);
    },
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "输入 / 使用命令，或直接开始书写...",
      }),
      WikiLink,
      WikiLinkHighlight.configure({
        onHover: (target: string, pos: { x: number; y: number }) => {
          hoverCallbacks.current.onHover(target, pos);
        },
        onLeave: () => {
          hoverCallbacks.current.onLeave();
        },
      }),
      SlashCommand,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      ImageExtension.configure({
        allowBase64: true,
        inline: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Typography,
      CharacterCount,
      Markdown,
    ],
    content: note?.content || "",
    contentType: "markdown",
    autofocus: false,
    editorProps: {
      attributes: {
        class: "tiptap outline-none min-h-full",
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "s") {
            event.preventDefault();
            if (saveTimerRef.current) {
              clearTimeout(saveTimerRef.current);
              saveTimerRef.current = undefined;
            }
            pendingSaveRef.current?.();
            pendingSaveRef.current = null;
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      const md = editor.getMarkdown();
      const nid = noteIdRef.current;
      const tid = tabIdRef.current;
      setContent(nid, md);
      setDirty(tid, true);
      saveVersionRef.current++;
      const myVersion = saveVersionRef.current;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingSaveRef.current = async () => {
        try {
          if (isTauri()) {
            const { readTextFile, writeTextFile } = await import("@tauri-apps/plugin-fs");
            const raw = await readTextFile(nid);
            if (raw.startsWith("---\n")) {
              const end = raw.indexOf("\n---\n", 4);
              if (end !== -1) {
                const frontmatter = raw.slice(0, end + 5);
                await writeTextFile(nid, frontmatter + "\n" + md);
              } else {
                await writeTextFile(nid, md);
              }
            } else {
              await writeTextFile(nid, md);
            }
          } else {
            await api.notes.update(nid, { content: md });
          }
          if (saveVersionRef.current === myVersion) {
            setDirty(tid, false);
          }
        } catch {}
      };
      saveTimerRef.current = setTimeout(() => {
        pendingSaveRef.current?.();
        pendingSaveRef.current = null;
      }, 1000);
      },
    });

  useEffect(() => {
    if (editor && note) {
      if (editor.getMarkdown() !== note.content) {
        editor.commands.setContent(note.content, { contentType: "markdown" });
      }
    }
  }, [noteId, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        pendingSaveRef.current?.();
        pendingSaveRef.current = null;
      }
    };
  }, []);

  // Listen for editor:format events from the markdown-format plugin
  useEffect(() => {
    const handler = (e: Event) => {
      const { action } = (e as CustomEvent).detail;
      if (!editor) return;
      switch (action) {
        case "toggleBold":        editor.chain().focus().toggleBold().run(); break;
        case "toggleItalic":      editor.chain().focus().toggleItalic().run(); break;
        case "toggleH1":          editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
        case "toggleH2":          editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
        case "toggleH3":          editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
        case "toggleBulletList":  editor.chain().focus().toggleBulletList().run(); break;
        case "toggleOrderedList": editor.chain().focus().toggleOrderedList().run(); break;
        case "toggleBlockquote":  editor.chain().focus().toggleBlockquote().run(); break;
      }
    };
    window.addEventListener("editor:format", handler);
    return () => window.removeEventListener("editor:format", handler);
  }, [editor]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateTitle(tabId, e.target.value);
    },
    [tabId, updateTitle]
  );

  if (!editor) return null;

  return (
    <div className="h-full overflow-y-auto relative">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex items-start gap-2 mb-4">
          <input
            type="text"
            value={note?.title || ""}
            placeholder="笔记标题"
            onChange={handleTitleChange}
            className="flex-1 text-3xl font-bold bg-transparent outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          />
          <button
            onClick={() => setShowMeta(!showMeta)}
            className={cn(
              "mt-2 p-1.5 rounded-md transition-colors shrink-0",
              showMeta
                ? "bg-accent/15 text-accent"
                : "text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
            title="元数据"
          >
            <FaCircleInfo size={16} />
          </button>
        </div>

        {showMeta && note && (
          <div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-xs animate-fade-in">
            <MetaRow label="ID" value={note.id.slice(0, 8) + "…"} />
            <MetaRow label="路径" value={note.path} />
            <MetaRow label="创建" value={fmtDate(note.created)} />
            <MetaRow label="更新" value={fmtDate(note.updated)} />
            {note.tags && note.tags.length > 0 && (
              <MetaRow label="标签" value={note.tags.join(", ")} />
            )}
            {note.aliases && note.aliases.length > 0 && (
              <MetaRow label="别名" value={note.aliases.join(", ")} />
            )}
          </div>
        )}

        <div className="relative">
          {/* Notion-style block handle */}
          <BlockHandle editor={editor} />

          {/* Bubble menu on text selection */}
          {editor && (
            <BubbleMenu
              editor={editor}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-1 space-y-1"
            >
              {/* Inline marks */}
              <div className="flex items-center gap-0.5">
                <BubbleBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗"><FaBold size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><FaItalic size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线"><FaStrikethrough size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="行内代码"><FaCode size={15} /></BubbleBtn>
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
                <BubbleBtn active={editor.isActive("link")} onClick={() => {
                  const prev = editor.getAttributes("link").href;
                  const url = window.prompt("链接地址", prev || "https://");
                  if (url === null) return;
                  if (url === "") { editor.chain().focus().unsetLink().run(); return; }
                  editor.chain().focus().setLink({ href: url }).run();
                }} title="链接"><FaLink size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="高亮"><FaHighlighter size={15} /></BubbleBtn>
                <BubbleBtn active={false} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="清除格式"><FaUnderline size={15} /></BubbleBtn>
              </div>
              {/* Block type */}
              <div className="flex items-center gap-0.5 border-t border-zinc-100 dark:border-zinc-800 pt-1">
                <BubbleBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="标题1"><FaHeading size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="标题2"><FaHeading size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="标题3"><FaHeading size={15} /></BubbleBtn>
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
                <BubbleBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表"><FaListUl size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表"><FaListOl size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用"><FaQuoteRight size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="任务列表"><FaListCheck size={15} /></BubbleBtn>
              </div>
              {/* Alignment & Insert */}
              <div className="flex items-center gap-0.5 border-t border-zinc-100 dark:border-zinc-800 pt-1">
                <BubbleBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="左对齐"><FaAlignLeft size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="居中"><FaAlignCenter size={15} /></BubbleBtn>
                <BubbleBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="右对齐"><FaAlignRight size={15} /></BubbleBtn>
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
                <BubbleBtn active={false} onClick={() => {
                  const url = window.prompt("图片地址", "https://");
                  if (url) editor.chain().focus().setImage({ src: url }).run();
                }} title="插入图片"><FaImage size={15} /></BubbleBtn>
                <BubbleBtn active={false} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="插入表格"><FaTable size={15} /></BubbleBtn>
              </div>
            </BubbleMenu>
          )}

          <EditorContent editor={editor} />
          <HoverPreview
            target={hoverTarget}
            position={hoverPos}
            onMouseEnter={() => { previewHoveredRef.current = true; }}
            onMouseLeave={() => {
              previewHoveredRef.current = false;
              setHoverTarget(null);
              setHoverPos(null);
            }}
          />
        </div>
      </div>
      <SlashOverlay editor={editor} />
    </div>
  );
}

// ── Metadata helpers ──
function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 py-0.5 text-zinc-500 dark:text-zinc-400">
      <span className="shrink-0 w-10 text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className="text-zinc-700 dark:text-zinc-300 truncate">{value}</span>
    </div>
  );
}

// ── Notion-style Block Handle ──
const BLOCK_OPTIONS = [
  { id: "paragraph", icon: FaParagraph, label: "正文" },
  { id: "h1", icon: FaHeading, label: "标题 1" },
  { id: "h2", icon: FaHeading, label: "标题 2" },
  { id: "h3", icon: FaHeading, label: "标题 3" },
  { id: "bulletList", icon: FaListUl, label: "无序列表" },
  { id: "orderedList", icon: FaListOl, label: "有序列表" },
  { id: "blockquote", icon: FaQuoteRight, label: "引用" },
] as const;

function getActiveBlock(editor: NonNullable<ReturnType<typeof useEditor>>) {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("bulletList")) return "bulletList";
  if (editor.isActive("orderedList")) return "orderedList";
  if (editor.isActive("blockquote")) return "blockquote";
  return "paragraph";
}

function applyBlock(editor: NonNullable<ReturnType<typeof useEditor>>, type: string) {
  switch (type) {
    case "h1": editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
    case "h2": editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
    case "h3": editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
    case "bulletList": editor.chain().focus().toggleBulletList().run(); break;
    case "orderedList": editor.chain().focus().toggleOrderedList().run(); break;
    case "blockquote": editor.chain().focus().toggleBlockquote().run(); break;
    default: editor.chain().focus().setParagraph().run();
  }
}

function BlockHandle({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track cursor block position
  useEffect(() => {
    const update = () => {
      try {
        const { $from } = editor.state.selection;
        const node = editor.view.nodeDOM($from.start($from.depth));
        if (node instanceof HTMLElement) {
          const blockRect = node.getBoundingClientRect();
          // Position 32px left of the block, vertically centered
          setPos({
            top: blockRect.top + blockRect.height / 2,
            left: blockRect.left - 36,
          });
        } else {
          setPos(null);
        }
      } catch {
        setPos(null);
      }
    };

    editor.on("selectionUpdate", update);
    editor.on("focus", update);
    update();

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
    };
  }, [editor]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeBlock = getActiveBlock(editor);

  if (!pos) return null;

  return (
    <div ref={containerRef} className="fixed z-10 pointer-events-none" style={{ left: 0, top: 0, width: 0, height: 0 }}>
      <div
        className="absolute pointer-events-auto"
        style={{ left: pos.left, top: pos.top, transform: "translateY(-50%)" }}
      >
        <button
          onClick={() => setOpen(!open)}
          className="p-1 rounded text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          title="块类型"
        >
          <FaGripVertical size={16} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-7 -top-0 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl py-1 z-20">
            {BLOCK_OPTIONS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => {
                  applyBlock(editor, id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors",
                  activeBlock === id
                    ? "bg-accent/10 text-accent"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bubble Menu Button ──
function BubbleBtn({ children, active, onClick, title }: { children: React.ReactNode; active: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        active ? "bg-accent/15 text-accent" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
      )}
    >
      {children}
    </button>
  );
}

// ── Slash Overlay ──
function SlashOverlay({ editor: _editor }: { editor: ReturnType<typeof useEditor> }) {
  const { visible, items, position, selectedIdx, handleSelect, setIdx } = useSlashMenu();
  if (!visible) return null;
  return <SlashMenu items={items} position={position} selectedIdx={selectedIdx} onSelect={handleSelect} onHover={setIdx} />;
}
