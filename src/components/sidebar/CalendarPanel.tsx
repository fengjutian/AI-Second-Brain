import { useState, useEffect, useMemo, useCallback } from "react";
import { FaChevronLeft, FaChevronRight, FaFile } from "react-icons/fa6";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { api } from "@/lib/api";
import { isTauri } from "@/lib/env";
import { cn } from "@/lib/utils";

interface NoteEntry {
  id: string;
  title: string;
  path: string;
  created: string;
}

// Cache scan results per vault to avoid rescanning on every pane switch
const scanCache = new Map<string, NoteEntry[]>();

/** Invalidate the calendar scan cache (called after note creation/deletion). */
export function invalidateCalendarCache(vaultPath?: string) {
  if (vaultPath) {
    scanCache.delete(vaultPath);
  } else {
    scanCache.clear();
  }
}

/** Group notes by date string (YYYY-MM-DD). */
function groupByDate(notes: NoteEntry[]): Map<string, NoteEntry[]> {
  const map = new Map<string, NoteEntry[]>();
  for (const note of notes) {
    const day = note.created.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(note);
  }
  return map;
}

export function CalendarPanel() {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date(); // Re-computed each render — stays accurate across midnight
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const loadNote = useNoteStore((s) => s.loadNote);
  const openTab = useTabStore((s) => s.openTab);

  // Fetch all notes with created dates
  useEffect(() => {
    if (!vaultPath) return;

    const fetchNotes = async () => {
      // Use cached result if available for this vault
      if (scanCache.has(vaultPath)) {
        setNotes(scanCache.get(vaultPath)!);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let results: NoteEntry[];

        if (isTauri()) {
          // Tauri: scan directory + parse frontmatter for dates
          const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
          results = [];

          const scan = async (dirPath: string, basePath: string) => {
            const entries = await readDir(dirPath);
            for (const entry of entries) {
              if (entry.name.startsWith(".") || entry.name === ".trash") continue;
              const fullPath = `${dirPath}/${entry.name}`;
              if (entry.isDirectory) {
                await scan(fullPath, basePath);
              } else if (entry.name.endsWith(".md")) {
                const relPath = fullPath.slice(basePath.length + 1);
                const raw = await readTextFile(fullPath);
                const normalized = raw.replace(/\r\n/g, "\n");
                let created = "";
                let title = entry.name.replace(/\.md$/, "");

                if (normalized.startsWith("---\n")) {
                  const end = normalized.indexOf("\n---\n", 4);
                  if (end !== -1) {
                    const frontmatter = normalized.slice(4, end);
                    for (const line of frontmatter.split("\n")) {
                      if (line.startsWith("created:")) {
                        created = line.slice(8).trim().replace(/^"|"$/g, "");
                      }
                      if (line.startsWith("title:")) {
                        title = line.slice(6).trim().replace(/^"|"$/g, "") || title;
                      }
                    }
                  }
                }
                if (created) {
                  results.push({ id: fullPath, title, path: relPath, created });
                }
              }
            }
          };

          await scan(vaultPath, vaultPath);
        } else {
          const data = await api.notes.list();
          results = data.map((n: any) => ({
            id: n.id,
            title: n.title,
            path: n.path,
            created: n.created,
          }));
        }

        scanCache.set(vaultPath, results);
        setNotes(results);
      } catch (e) {
        console.error("Failed to load notes for calendar:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [vaultPath]);

  // Group notes by date
  const notesByDate = useMemo(() => groupByDate(notes), [notes]);

  // Notes for selected date
  const selectedNotes = selectedDate ? notesByDate.get(selectedDate) || [] : [];

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [viewYear, viewMonth]);

  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
  ];

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDate(null);
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDate(null);
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    const todayStr = today.toISOString().slice(0, 10);
    setSelectedDate(todayStr);
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(dateStr);
  };

  const handleOpenNote = useCallback(
    async (note: NoteEntry) => {
      try {
        if (isTauri()) {
          const { readTextFile } = await import("@tauri-apps/plugin-fs");
          let raw = await readTextFile(note.id);
          const normalized = raw.replace(/\r\n/g, "\n");
          let body = normalized;
          if (normalized.startsWith("---\n")) {
            const end = normalized.indexOf("\n---\n", 4);
            if (end !== -1) body = normalized.slice(end + 5).trimStart();
          }
          loadNote(note.id, {
            id: note.id,
            path: note.path,
            title: note.title,
            content: body,
            tags: [],
            aliases: [],
            created: note.created,
            updated: note.created,
          });
          openTab({ noteId: note.id, title: note.title, path: note.path });
        } else {
          const fullNote = await api.notes.get(note.id);
          loadNote(note.id, fullNote);
          openTab({ noteId: note.id, title: note.title, path: note.path });
        }
      } catch (e) {
        console.error("Failed to open note:", e);
      }
    },
    [loadNote, openTab]
  );

  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">日历</span>
        <button
          onClick={goToday}
          className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          今天
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={goPrev}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
        >
          <FaChevronLeft size={10} />
        </button>
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {viewYear} 年 {monthNames[viewMonth]}
        </span>
        <button
          onClick={goNext}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
        >
          <FaChevronRight size={10} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 px-1">
        {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
          <div
            key={d}
            className="text-[10px] text-center text-zinc-400 font-medium py-0.5"
          >
            {d}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;

          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const noteCount = notesByDate.get(dateStr)?.length || 0;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => handleDayClick(day)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded py-0.5 text-xs transition-colors",
                "hover:bg-zinc-200 dark:hover:bg-zinc-800",
                isSelected && "bg-accent/15 text-accent font-semibold",
                isToday && !isSelected && "ring-1 ring-accent/40"
              )}
            >
              <span className={cn(
                "leading-tight",
                isToday && !isSelected && "text-accent font-semibold"
              )}>
                {day}
              </span>
              {noteCount > 0 && (
                <span className="text-[6px] leading-none mt-px text-accent">
                  {"●".repeat(Math.min(noteCount, 3))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date notes list */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-1">
        {loading ? (
          <p className="text-[11px] text-zinc-400 px-1">加载中...</p>
        ) : !selectedDate ? (
          <p className="text-[11px] text-zinc-400 px-1">点击日期查看文件</p>
        ) : selectedNotes.length === 0 ? (
          <div className="px-1">
            <p className="text-[11px] text-zinc-400 mb-1">{selectedDate}</p>
            <p className="text-[11px] text-zinc-400">当天没有创建文件</p>
          </div>
        ) : (
          <div>
            <p className="text-[11px] text-zinc-400 mb-1 px-1">
              {selectedDate} · {selectedNotes.length} 个文件
            </p>
            <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
              {selectedNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleOpenNote(note)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-left"
                >
                  <FaFile size={10} className="shrink-0 text-blue-500" />
                  <span className="truncate text-zinc-700 dark:text-zinc-300">
                    {note.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
