import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { useCallback, useEffect, useRef } from "react";

interface EditorProps {
  tabId: string;
  noteId: string;
}

export function Editor({ tabId, noteId }: EditorProps) {
  const note = useNoteStore((s) => s.notes.get(noteId));
  const setContent = useNoteStore((s) => s.setContent);
  const setDirty = useTabStore((s) => s.setDirty);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "开始书写...",
      }),
    ],
    content: note?.content || "",
    autofocus: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContent(noteId, html);
      setDirty(tabId, true);

      // Debounced auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        // TODO: call api.notes.update(noteId, { content: html })
        setDirty(tabId, false);
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

  if (!editor) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Title (editable plain text) */}
        <input
          type="text"
          value={note?.title || ""}
          placeholder="笔记标题"
          className="w-full text-3xl font-bold bg-transparent outline-none mb-4 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
          onChange={(e) => {
            // TODO: update title
          }}
        />
        {/* Content */}
        <EditorContent editor={editor} className="tiptap" />
      </div>
    </div>
  );
}
