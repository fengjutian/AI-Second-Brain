import { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { useSettingsStore } from "@/stores/settingsStore";
import { isTauri } from "@/lib/env";
import { FaTerminal, FaRotateRight } from "react-icons/fa6";

export function TerminalPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const vp = useSettingsStore((s) => s.vaultPath);
  const [started, setStarted] = useState(false);
  const [exited, setExited] = useState(false);

  const spawnTerm = useCallback(() => {
    if (!isTauri() || !vp) return;
    const term = termRef.current;
    if (!term) return;

    invoke("spawn_terminal", { cwd: vp, rows: term.rows, cols: term.cols }).then(() => {
      setStarted(true);
      setExited(false);
    }).catch(() => {});
  }, [vp]);

  useEffect(() => {
    if (!isTauri() || !vp) return;
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'Consolas, "Cascadia Code", monospace',
      theme: { background: "#1e1e1e", foreground: "#cccccc", cursor: "#ffffff" },
      cursorBlink: true,
      disableStdin: false,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);

    // WebGL renderer for better performance (fallback to DOM if unavailable)
    try { term.loadAddon(new WebglAddon()); } catch {}

    termRef.current = term;
    fitRef.current = fit;

    if (ref.current) {
      term.open(ref.current);
      fit.fit();
      term.focus();
    }

    // Start PTY
    spawnTerm();

    // Listen for PTY output
    const unlisten1 = listen<string>("pty-output", (e) => { term.write(e.payload); });

    // Handle shell exit
    const unlisten2 = listen("pty-exit", () => {
      setExited(true);
      setStarted(false);
      term.write("\r\n\x1b[31m██ 进程已退出。按 Ctrl+D 或点击 ↻ 重启终端\x1b[0m\r\n");
    });

    // Send input to PTY
    term.onData((data) => {
      if (exited) {
        // Restart on any key press after exit
        spawnTerm();
        return;
      }
      invoke("send_to_terminal", { data }).catch(() => {});
    });

    // Resize handling
    const handleResize = () => {
      if (fitRef.current) fitRef.current.fit();
      const t = termRef.current;
      if (t && started) {
        invoke("resize_pty", { rows: t.rows, cols: t.cols }).catch(() => {});
      }
    };
    term.onResize(handleResize);

    // ResizeObserver for container changes
    const resizeObserver = new ResizeObserver(() => {
      if (fitRef.current) fitRef.current.fit();
      const t = termRef.current;
      if (t && started) {
        invoke("resize_pty", { rows: t.rows, cols: t.cols }).catch(() => {});
      }
    });
    if (ref.current) resizeObserver.observe(ref.current);

    // Ctrl+Shift+C/V copy/paste
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel);
        return false;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        navigator.clipboard.readText().then((t) => {
          term.paste(t);
        });
        return false;
      }
      return true;
    });

    return () => {
      unlisten1.then((u) => u());
      unlisten2.then((u) => u());
      term.dispose();
      resizeObserver.disconnect();
    };
  }, [vp]);

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
        <span className="text-[10px] text-zinc-500 truncate">{vp}</span>
        <div className="flex-1" />
        {exited && (
          <button onClick={spawnTerm} className="text-[11px] text-accent hover:text-accent-hover flex items-center gap-1">
            <FaRotateRight size={10} /> 重启
          </button>
        )}
      </div>
      <div ref={ref} className="flex-1 overflow-hidden" style={{ padding: "4px 8px" }}
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
}
