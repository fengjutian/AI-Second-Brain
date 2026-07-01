import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useSettingsStore } from "@/stores/settingsStore";
import { isTauri } from "@/lib/env";
import { FaTerminal } from "react-icons/fa6";

export function TerminalPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const vp = useSettingsStore((s) => s.vaultPath);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!isTauri() || !vp || started) return;

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'Consolas, "Cascadia Code", monospace',
      theme: { background: "#1e1e1e", foreground: "#cccccc", cursor: "#ffffff" },
      cursorBlink: true,
      disableStdin: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;

    if (ref.current) {
      term.open(ref.current);
      fit.fit();
      term.focus(); // Auto-focus for keyboard input
    }

    // Start PTY
    const rows = term.rows;
    const cols = term.cols;
    invoke("spawn_terminal", { cwd: vp, rows, cols }).then(() => {
      setStarted(true);
    });

    // Listen for PTY output
    const unlisten = listen<string>("pty-output", (e) => {
      term.write(e.payload);
    });

    // Send input to PTY
    term.onData((data) => {
      invoke("send_to_terminal", { data }).catch(() => {});
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitRef.current) fitRef.current.fit();
    });
    if (ref.current) resizeObserver.observe(ref.current);

    return () => {
      unlisten.then((u) => u());
      term.dispose();
      resizeObserver.disconnect();
    };
  }, [vp, started]);

  if (!isTauri()) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm animate-slide-in-right">
        终端仅在 Tauri 桌面端可用
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 animate-slide-in-right bg-zinc-950">
      <div className="h-7 flex items-center gap-2 px-3 bg-zinc-800 border-b border-zinc-700 shrink-0">
        <FaTerminal size={12} className="text-green-400" />
        <span className="text-[11px] text-zinc-400">终端</span>
        <span className="text-[10px] text-zinc-500 truncate ml-1">{vp}</span>
      </div>
      <div ref={ref} className="flex-1 overflow-hidden" style={{ padding: "4px 8px" }}
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
}
