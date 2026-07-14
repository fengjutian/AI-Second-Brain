import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { useWhiteboardStore } from "@/stores/whiteboardStore";

export function StatusBar() {
  const currentId = useNoteStore((s) => s.currentId);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const note = useNoteStore((s) => (currentId ? s.notes[currentId] : null));
  const { savePath, saved } = useWhiteboardStore();

  return (
    <div className="h-7 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex items-center px-4 text-xs text-zinc-500 dark:text-zinc-400 gap-4 select-none shrink-0">
      {savePath ? (
        <span className={saved ? "text-green-500" : ""}>
          {saved ? `✓ 已保存` : `📋 ${savePath.split(/[/\\]/).pop()}`}
        </span>
      ) : (
        <>
          <span>{note?.path ? note.path.split(/[/\\]/).pop() : "—"}</span>
          <span>{note ? `${note.content.length} 字符` : ""}</span>
          {activeTab?.isDirty && <span className="text-accent">未保存</span>}
        </>
      )}
      <div className="flex-1" />
      <span>Rainstone v0.1</span>
    </div>
  );
}
