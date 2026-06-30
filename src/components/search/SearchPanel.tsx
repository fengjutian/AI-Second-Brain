import { useState, useCallback, useRef, useEffect } from "react";
import { FaMagnifyingGlass, FaSpinner } from "react-icons/fa6";
import { api } from "@/lib/api";
import { useNoteStore } from "@/stores/noteStore";
import { useTabStore } from "@/stores/tabStore";

interface SearchResult {
  note_id: string;
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<FaMagnifyingGlassResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const loadNote = useNoteStore((s) => s.loadNote);
  const openTab = useTabStore((s) => s.openTab);
  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce input
  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 250);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Search when debounced query changes
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 1) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    const id = ++requestIdRef.current;
    setLoading(true);
    api.search.keyword(q).then((data) => {
      if (id === requestIdRef.current) {
        setResults(data);
        setSearched(true);
        setLoading(false);
      }
    }).catch(() => {
      if (id === requestIdRef.current) {
        setResults([]);
        setSearched(true);
        setLoading(false);
      }
    });
  }, [debouncedQuery]);

  const handleOpen = async (result: SearchResult) => {
    const note = await api.notes.get(result.note_id);
    loadNote(result.note_id, note);
    openTab({ noteId: result.note_id, title: note.title, path: note.path });
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <FaMagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="搜索笔记..."
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-accent transition-colors"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-3">
          <FaSpinner size={16} className="animate-spin text-zinc-400" />
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-xs text-zinc-400 text-center py-3">无匹配结果</p>
      )}

      {results.length > 0 && (
        <div className="space-y-0.5">
          {results.map((r) => (
            <button
              key={r.note_id}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors"
              onClick={() => handleOpen(r)}
            >
              <div className="text-sm font-medium truncate">{r.title}</div>
              <div
                className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5"
                dangerouslySetInnerHTML={{ __html: r.snippet }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
