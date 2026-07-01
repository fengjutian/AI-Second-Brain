import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { wikiLinkSuggestion } from "@/components/editor/WikiLink";
import { WikiLinkHighlight } from "@/components/editor/WikiLinkHighlight";
import { HoverPreview } from "@/components/editor/HoverPreview";
import { SlashCommand } from "@/components/editor/SlashCommand";
import { useSlashMenu, SlashMenu } from "@/components/editor/SlashMenu";
import { api } from "@/lib/api";
import {
  FaBold, FaItalic, FaStrikethrough, FaCode, FaHeading, FaListUl, FaListOl, FaQuoteRight, FaParagraph, FaGripVertical, FaUnderline, FaLink,
} from "react-icons/fa6";
import { cn } from "@/lib/utils";

const WikiLink = Mention.configure({
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
  const note = useNoteStore((s) => s.notes.get(noteId));
  const setContent = useNoteStore((s) => s.setContent);
  const setDirty = useTabStore((s) => s.setDirty);
  const updateTitle = useTabStore((s) => s.updateTitle);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const noteIdRef = useRef(noteId);
  const tabIdRef = useRef(tabId);
  noteIdRef.current = noteId;
  tabIdRef.current = tabId;
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
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
    ],
    content: note?.content || "",
    autofocus: false,
    editorProps: {
      attributes: {
        class: "tiptap outline-none min-h-full",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const nid = noteIdRef.current;
      const tid = tabIdRef.current;
      setContent(nid, html);
      setDirty(tid, true);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.notes.update(nid, { content: html });
          setDirty(tid, false);
        } catch {}
      }, 1000);
    },
  });

  useEffect(() => {
    if (editor && note) {
      const currentContent = editor.getHTML();
      if (currentContent !== note.content) {
        editor.commands.setContent(note.content);
      }
    }
  }, [noteId, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
        <input
          type="text"
          value={note?.title || ""}
          placeholder="笔记标题"
          onChange={handleTitleChange}
          className="w-full text-3xl font-bold bg-transparent outline-none mb-4 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
        />

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
              </div>
            </BubbleMenu>
          )}

          <EditorContent editor={editor} />
          <HoverPreview target={hoverTarget} position={hoverPos} />
        </div>
      </div>
      <SlashOverlay editor={editor} />
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
function SlashOverlay({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const { visible, items, position, selectedIdx, handleSelect, setIdx } = useSlashMenu();
  if (!visible) return null;
  return <SlashMenu items={items} position={position} selectedIdx={selectedIdx} onSelect={handleSelect} onHover={setIdx} />;
}
