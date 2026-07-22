import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { useSettingsStore } from "@/stores/settingsStore";
import { isTauri } from "@/lib/env";
import {
  FaTerminal,
  FaRotateRight,
  FaPlus,
  FaXmark,
  FaMagnifyingGlass,
  FaChevronUp,
  FaChevronDown,
} from "react-icons/fa6";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface TabMeta {
  id: string;
  title: string;
  shell: string;
  started: boolean;
  exited: boolean;
}

interface TerminalEntry {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
}

type ShellDef = { label: string; path: string };

const WINDOWS_SHELLS: ShellDef[] = [
  { label: "CMD", path: "cmd.exe" },
  { label: "PowerShell", path: "powershell.exe" },
];

const UNIX_SHELLS: ShellDef[] = [
  { label: "Bash", path: "/bin/bash" },
  { label: "Zsh", path: "/bin/zsh" },
  { label: "Fish", path: "/bin/fish" },
];

function getDefaultShells(): ShellDef[] {
  // Simple platform detection via userAgent
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("Win")) {
    return WINDOWS_SHELLS;
  }
  return UNIX_SHELLS;
}

let tabCounter = 0;
function nextTabId() {
  tabCounter += 1;
  return `t${tabCounter}`;
}

// ---------------------------------------------------------------------------
// Single-tab Xterm hook
// ---------------------------------------------------------------------------

function useXtermTab(
  tabId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
  vp: string,
  shell: string,
  fontSize: number,
  onStatus: (tabId: string, started: boolean, exited: boolean) => void,
) {
  const entryRef = useRef<TerminalEntry | null>(null);
  const [started, setStarted] = useState(false);
  const [exited, setExited] = useState(false);
  const startedRef = useRef(false);
  const exitedRef = useRef(false);
  const unlistenRef = useRef<Array<() => void>>([]);

  const spawnTerm = useCallback(() => {
    if (!isTauri() || !vp) return;
    const entry = entryRef.current;
    if (!entry) return;
    invoke("spawn_terminal", {
      tabId: tabId,
      cwd: vp,
      rows: entry.terminal.rows,
      cols: entry.terminal.cols,
      shell,
    })
      .then(() => {
        setStarted(true);
        startedRef.current = true;
        setExited(false);
        exitedRef.current = false;
        onStatus(tabId, true, false);
      })
      .catch(() => {});
  }, [vp, shell]);

  // Initialise terminal on mount
  useEffect(() => {
    if (!isTauri() || !vp) return;

    const term = new Terminal({
      fontSize,
      fontFamily: 'Consolas, "Cascadia Code", monospace',
      theme: { background: "#1e1e1e", foreground: "#cccccc", cursor: "#ffffff" },
      cursorBlink: true,
      disableStdin: false,
      scrollback: 10000,
      allowProposedApi: true,
      bellStyle: "sound",
    });

    const fit = new FitAddon();
    const search = new SearchAddon();
    const webLinks = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(search);
    term.loadAddon(webLinks);

    // WebGL renderer (fallback silently)
    try { term.loadAddon(new WebglAddon()); } catch {}

    entryRef.current = { terminal: term, fitAddon: fit, searchAddon: search };

    // Open in DOM
    if (containerRef.current) {
      term.open(containerRef.current);
      fit.fit();
      term.focus();
    }

    spawnTerm();

    // PTY output listener (filtered by tab_id)
    const p1 = listen<string>("pty-output", (e) => {
      try {
        const msg = JSON.parse(e.payload);
        if (msg.tab_id !== tabId) return;
        term.write(msg.data);
      } catch { term.write(e.payload); }
    });

    // Exit listener (filtered by tab_id)
    const p2 = listen<string>("pty-exit", (e) => {
      try {
        const msg = JSON.parse(e.payload);
        if (msg.tab_id !== tabId) return;
      } catch {}
      setExited(true);
      exitedRef.current = true;
      setStarted(false);
      startedRef.current = false;
      term.write("\r\n\x1b[31m██ 进程已退出。按任意键或点击 ↻ 重启\x1b[0m\r\n");
      onStatus(tabId, false, true);
    });

    unlistenRef.current = [() => { p1.then((u) => u()); }, () => { p2.then((u) => u()); }];

    // Send keystrokes to PTY
    term.onData((data) => {
      if (exitedRef.current) {
        spawnTerm();
        return;
      }
      invoke("send_to_terminal", { tabId: tabId, data }).catch(() => {});
    });

    // Resize handling
    const handleResize = () => {
      fit.fit();
      if (startedRef.current) {
        invoke("resize_pty", { tabId: tabId, rows: term.rows, cols: term.cols }).catch(() => {});
      }
    };
    term.onResize(handleResize);

    const ro = new ResizeObserver(() => {
      fit.fit();
      if (startedRef.current) {
        invoke("resize_pty", { tabId: tabId, rows: term.rows, cols: term.cols }).catch(() => {});
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);

    // Font zoom: Ctrl+Plus / Ctrl+Minus / Ctrl+0
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (e.key === "=" || e.key === "+") {
          const fs = Math.min(32, (term.options.fontSize ?? 14) + 1);
          term.options.fontSize = fs;
          fit.fit();
          return false;
        }
        if (e.key === "-") {
          const fs = Math.max(8, (term.options.fontSize ?? 14) - 1);
          term.options.fontSize = fs;
          fit.fit();
          return false;
        }
        if (e.key === "0") {
          term.options.fontSize = fontSize;
          fit.fit();
          return false;
        }
        // Ctrl+Shift+C / Ctrl+Shift+V
        if (e.shiftKey && e.key === "C") {
          const sel = term.getSelection();
          if (sel) navigator.clipboard.writeText(sel);
          return false;
        }
        if (e.shiftKey && e.key === "V") {
          navigator.clipboard.readText().then((t) => term.paste(t));
          return false;
        }
      }
      return true;
    });

    return () => {
      // Kill the PTY on unmount (tab closed)
      invoke("kill_terminal", { tabId: tabId }).catch(() => {});
      ro.disconnect();
      unlistenRef.current.forEach((u) => u());
      term.dispose();
    };
    // Only re-create when vp or shell changes (rare)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp, shell]);

  // Update font size when prop changes (e.g. global setting)
  useEffect(() => {
    const entry = entryRef.current;
    if (entry) {
      entry.terminal.options.fontSize = fontSize;
    }
  }, [fontSize]);

  return { entryRef, started, exited, spawnTerm, fitAddon: () => entryRef.current?.fitAddon, searchAddon: () => entryRef.current?.searchAddon };
}

// ---------------------------------------------------------------------------
// TerminalPanel
// ---------------------------------------------------------------------------

export function TerminalPanel() {
  const vp = useSettingsStore((s) => s.vaultPath);
  const [tabs, setTabs] = useState<TabMeta[]>(() => [
    { id: nextTabId(), title: "终端", shell: getDefaultShells()[0].path, started: false, exited: false },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [fontSize, setFontSize] = useState(13);
  const [shellPickerOpen, setShellPickerOpen] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Each tab has its own container ref
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const shells = useMemo(() => getDefaultShells(), []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // --- Tab status sync ---
  const handleTabStatus = useCallback((tabId: string, started: boolean, exited: boolean) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, started, exited } : t)));
  }, []);

  // --- Tab operations ---

  const addTab = useCallback(() => {
    const id = nextTabId();
    const sh = activeTab?.shell ?? shells[0].path;
    const label = shells.find((s) => s.path === sh)?.label ?? "终端";
    setTabs((prev) => [...prev, { id, title: label, shell: sh, started: false, exited: false }]);
    setActiveTabId(id);
  }, [activeTab, shells]);

  const closeTab = useCallback(
    (id: string) => {
      // Kill the PTY for this tab
      // (We rely on the backend kill_terminal for the current active; for now just remove the tab)
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) {
          const nid = nextTabId();
          return [{ id: nid, title: "终端", shell: shells[0].path, started: false, exited: false }];
        }
        return next;
      });
      if (activeTabId === id) {
        setActiveTabId((prev) => {
          const remaining = tabs.filter((t) => t.id !== id);
          return remaining[0]?.id ?? prev;
        });
      }
    },
    [activeTabId, tabs, shells],
  );

  const setTabShell = useCallback((tabId: string, shell: string) => {
    const label = shells.find((s) => s.path === shell)?.label ?? "终端";
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, shell, title: label } : t)));
    setShellPickerOpen(false);
  }, [shells]);

  // --- Search ---

  const activeEntryRef = useRef<TerminalEntry | null>(null);
  const setActiveEntry = useCallback((e: TerminalEntry | null) => {
    activeEntryRef.current = e;
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchVisible((v) => {
      if (!v) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else {
        setSearchTerm("");
      }
      return !v;
    });
  }, []);

  const doSearch = useCallback(
    (dir: "next" | "prev") => {
      const entry = activeEntryRef.current;
      if (!entry || !searchTerm) return;
      if (dir === "next") {
        entry.searchAddon.findNext(searchTerm, { caseSensitive: false, wholeWord: false, regex: false });
      } else {
        entry.searchAddon.findPrevious(searchTerm, { caseSensitive: false, wholeWord: false, regex: false });
      }
    },
    [searchTerm],
  );

  useEffect(() => {
    if (searchVisible && searchTerm) {
      doSearch("next");
    }
  }, [searchTerm, searchVisible, doSearch]);

  // --- Global keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        toggleSearch();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        addTab();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "W") {
        e.preventDefault();
        if (activeTab) closeTab(activeTab.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSearch, addTab, closeTab, activeTab]);

  // --- Non-Tauri fallback ---
  if (!isTauri()) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm animate-slide-in-right">
        终端仅在 Tauri 桌面端可用
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 animate-slide-in-right bg-zinc-950">
      {/* ---- Tab bar ---- */}
      <div className="h-8 flex items-center bg-zinc-850 border-b border-zinc-700 shrink-0">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`h-8 px-3 flex items-center gap-1.5 text-[11px] shrink-0 border-r border-zinc-700 transition-colors ${
                tab.id === activeTabId
                  ? "bg-zinc-950 text-zinc-200"
                  : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              <FaTerminal size={10} className={tab.exited ? "text-red-400" : tab.started ? "text-green-400" : "text-zinc-500"} />
              <span className="truncate max-w-[120px]">{tab.title}</span>
              <span
                className="ml-0.5 p-0.5 rounded hover:bg-zinc-600/50 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <FaXmark size={8} />
              </span>
            </button>
          ))}
        </div>
        <button onClick={addTab} className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 shrink-0" title="新建终端 (Ctrl+Shift+N)">
          <FaPlus size={10} />
        </button>
      </div>

      {/* ---- Tool bar ---- */}
      <div className="h-7 flex items-center gap-1 px-2 bg-zinc-800 border-b border-zinc-700 shrink-0">
        {/* Shell selector */}
        <div className="relative">
          <button
            onClick={() => setShellPickerOpen((v) => !v)}
            className="h-5 px-1.5 flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
          >
            {shells.find((s) => s.path === activeTab?.shell)?.label ?? "Shell"}
            <FaChevronDown size={6} />
          </button>
          {shellPickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShellPickerOpen(false)} />
              <div className="absolute top-full left-0 mt-0.5 z-50 bg-zinc-800 border border-zinc-600 rounded shadow-lg py-0.5 min-w-[140px]">
                {shells.map((s) => (
                  <button
                    key={s.path}
                    onClick={() => activeTab && setTabShell(activeTab.id, s.path)}
                    className={`block w-full text-left px-3 py-1 text-[11px] hover:bg-zinc-700 transition-colors ${
                      activeTab?.shell === s.path ? "text-accent" : "text-zinc-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Font size */}
        <span className="text-[10px] text-zinc-500">{fontSize}px</span>

        {/* Search toggle */}
        <button
          onClick={toggleSearch}
          className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${
            searchVisible ? "bg-accent/30 text-accent" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"
          }`}
          title="搜索 (Ctrl+Shift+F)"
        >
          <FaMagnifyingGlass size={10} />
        </button>

        {/* Restart */}
        {activeTab?.exited && (
          <button
            onClick={() => {
              // Trigger restart — handled by the TabView's spawnTerm
              window.dispatchEvent(new CustomEvent("restart-terminal", { detail: activeTab.id }));
            }}
            className="h-5 px-1.5 flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover rounded hover:bg-zinc-700 transition-colors"
          >
            <FaRotateRight size={8} /> 重启
          </button>
        )}
      </div>

      {/* ---- Search bar ---- */}
      {searchVisible && (
        <div className="h-7 flex items-center gap-1 px-2 bg-zinc-900 border-b border-zinc-700 shrink-0">
          <FaMagnifyingGlass size={9} className="text-zinc-500 shrink-0" />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doSearch(e.shiftKey ? "prev" : "next");
              }
              if (e.key === "Escape") {
                setSearchVisible(false);
                setSearchTerm("");
              }
            }}
            placeholder="搜索终端输出…"
            className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder-zinc-500 outline-none"
          />
          <button onClick={() => doSearch("prev")} className="h-5 w-5 flex items-center justify-center text-zinc-500 hover:text-zinc-200 rounded" title="上一个">
            <FaChevronUp size={8} />
          </button>
          <button onClick={() => doSearch("next")} className="h-5 w-5 flex items-center justify-center text-zinc-500 hover:text-zinc-200 rounded" title="下一个">
            <FaChevronDown size={8} />
          </button>
          <button
            onClick={() => { setSearchVisible(false); setSearchTerm(""); }}
            className="h-5 w-5 flex items-center justify-center text-zinc-500 hover:text-zinc-200 rounded"
          >
            <FaXmark size={8} />
          </button>
        </div>
      )}

      {/* ---- Terminal viewports ---- */}
      <div className="flex-1 relative overflow-hidden">
        {tabs.map((tab) => (
          <TabView
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            vp={vp}
            fontSize={fontSize}
            onSetEntry={tab.id === activeTabId ? setActiveEntry : undefined}
            onStatus={handleTabStatus}
            containerRefs={containerRefs}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabView — renders the xterm container for one tab
// ---------------------------------------------------------------------------

function TabView({
  tab,
  isActive,
  vp,
  fontSize,
  onSetEntry,
  onStatus,
  containerRefs,
}: {
  tab: TabMeta;
  isActive: boolean;
  vp: string;
  fontSize: number;
  onSetEntry?: (e: TerminalEntry | null) => void;
  onStatus: (tabId: string, started: boolean, exited: boolean) => void;
  containerRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const localRef = useRef<HTMLDivElement | null>(null);

  const { entryRef, spawnTerm } = useXtermTab(
    tab.id,
    localRef,
    vp,
    tab.shell,
    fontSize,
    onStatus,
  );

  // Report entry to parent for search
  useEffect(() => {
    if (isActive && onSetEntry) {
      onSetEntry(entryRef.current);
    }
  }, [isActive, onSetEntry, entryRef]);

  // Listen for restart event
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === tab.id) spawnTerm();
    };
    window.addEventListener("restart-terminal", handler);
    return () => window.removeEventListener("restart-terminal", handler);
  }, [isActive, tab.id, spawnTerm]);

  return (
    <div
      ref={(el) => {
        localRef.current = el;
        if (el) containerRefs.current.set(tab.id, el);
      }}
      className="absolute inset-0"
      style={{
        display: isActive ? "block" : "none",
        padding: "4px 8px",
      }}
      onClick={() => entryRef.current?.terminal.focus()}
    />
  );
}
