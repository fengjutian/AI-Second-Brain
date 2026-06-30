import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { wikiLinkSuggestion } from "@/components/editor/WikiLink";
import { WikiLinkHighlight } from "@/components/editor/WikiLinkHighlight";
import { HoverPreview } from "@/components/editor/HoverPreview";
import { api } from "@/lib/api";

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

  // Keep hover callbacks in sync
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
        placeholder: "开始书写... [[链接]]  #标签",
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

      // Debounced auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.notes.update(nid, { content: html });
          setDirty(tid, false);
        } catch {
          // Backend not available — will retry
        }
      }, 1000);
    },
  });

  // Update editor content when switching notes
  useEffect(() => {
    if (editor && note) {
      const currentContent = editor.getHTML();
      if (currentContent !== note.content) {
        editor.commands.setContent(note.content);
      }
    }
  }, [noteId, editor]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      updateTitle(tabId, newTitle);
      // TODO: update frontmatter via API
    },
    [tabId, updateTitle]
  );

  if (!editor) return null;

  return (
    <div className="h-full overflow-y-auto relative">
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Title */}
        <input
          type="text"
          value={note?.title || ""}
          placeholder="笔记标题"
          onChange={handleTitleChange}
          className="w-full text-3xl font-bold bg-transparent outline-none mb-4 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
        />

        {/* Editor */}
        <div className="relative">
          <EditorContent editor={editor} />
          <HoverPreview target={hoverTarget} position={hoverPos} />
        </div>
      </div>
    </div>
  );
}
