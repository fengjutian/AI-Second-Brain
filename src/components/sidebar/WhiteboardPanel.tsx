import { useEffect, useState, useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWhiteboardStore } from "@/stores/whiteboardStore";
import { isTauri } from "@/lib/env";
import { FaPlus } from "react-icons/fa6";
import { InputDialog } from "@/components/ui/InputDialog";

// Per-file cache: Map<filename, { elements, appState }>
const fileCache = new Map<string, any>();
let vaultKey = "";

export function WhiteboardPanel() {
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const theme = useSettingsStore((s) => s.theme);
  const { setSavePath, setSaved } = useWhiteboardStore();

  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState("whiteboard");
  const [initialData, setInitialData] = useState<any>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const loadedRef = useRef(false);

  const savePath = vaultPath && activeFile
    ? `${vaultPath.replace(/\\/g, "/")}/.aisb/${activeFile}.excalidraw`
    : null;

  // Eagerly ensure .aisb directory exists on mount
  useEffect(() => {
    if (!isTauri() || !vaultPath) return;
    const dir = `${vaultPath.replace(/\\/g, "/")}/.aisb`;
    import("@tauri-apps/plugin-fs").then(async ({ exists, mkdir }) => {
      const ok = await exists(dir);
      if (!ok) {
        await mkdir(dir).catch((e) => console.error("Whiteboard: failed to create .aisb dir:", e));
      }
    });
  }, [vaultPath]);

  // Scan existing files
  const scanFiles = useCallback(async () => {
    if (!isTauri() || !vaultPath) return;
    const dirPath = `${vaultPath.replace(/\\/g, "/")}/.aisb`;
    const { exists, readDir, mkdir } = await import("@tauri-apps/plugin-fs");
    if (!(await exists(dirPath))) {
      await mkdir(dirPath).catch(() => {});
      setFiles(["whiteboard"]); // ← fix: set default even on first run
      return;
    }
    const entries = await readDir(dirPath);
    const names = entries
      .filter((e) => e.name?.endsWith(".excalidraw"))
      .map((e) => e.name!.replace(/\.excalidraw$/, ""));
    if (names.length === 0) {
      setFiles(["whiteboard"]);
    } else {
      setFiles(names);
      // Auto-select: if current file doesn't exist, switch to first
      if (!names.includes(activeFile)) {
        setActiveFile(names[0]);
      }
    }
  }, [vaultPath]); // Only rescan when vault changes

  useEffect(() => { scanFiles(); }, [scanFiles]);

  // Load active file
  useEffect(() => {
    if (!isTauri() || !vaultPath || !activeFile) return;
    const filePath = `${vaultPath.replace(/\\/g, "/")}/.aisb/${activeFile}.excalidraw`;
    setSavePath(filePath);

    // Check cache first
    const cacheKey = `${vaultPath}:${activeFile}`;
    if (fileCache.has(cacheKey)) {
      setInitialData(fileCache.get(cacheKey));
      loadedRef.current = true;
      return;
    }

    import("@tauri-apps/plugin-fs").then(({ exists, readTextFile }) => {
      exists(filePath).then((ok) => {
        if (ok) readTextFile(filePath).then((raw) => {
          try {
            const data = JSON.parse(raw);
            fileCache.set(cacheKey, data);
            setInitialData(data);
          } catch { setInitialData(null); }
        });
        else setInitialData(null);
        loadedRef.current = true;
      });
    });
  }, [vaultPath, activeFile]);

  const handleChange = useCallback(
    (elements: readonly any[], state: any) => {
      if (!isTauri() || !savePath) return;
      const cacheKey = `${vaultPath}:${activeFile}`;
      const data = { elements, appState: state };
      fileCache.set(cacheKey, data);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const { writeTextFile, exists, mkdir } = await import("@tauri-apps/plugin-fs");
        // Ensure directory exists
        const dir = `${vaultPath!.replace(/\\/g, "/")}/.aisb`;
        const dirExists = await exists(dir);
        if (!dirExists) await mkdir(dir).catch(() => {});
        // Write file
        await writeTextFile(savePath, JSON.stringify(data));
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }, 2000);
    }, [savePath, vaultPath, activeFile]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const createNew = useCallback(async (name: string) => {
    if (!name) return;
    // Save current board before switching
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); }
    if (isTauri() && savePath) {
      const cacheKey = `${vaultPath}:${activeFile}`;
      const data = fileCache.get(cacheKey);
      if (data) {
        const { writeTextFile, exists, mkdir } = await import("@tauri-apps/plugin-fs");
        const dir = `${vaultPath!.replace(/\\/g, "/")}/.aisb`;
        if (!(await exists(dir))) await mkdir(dir).catch(() => {});
        await writeTextFile(savePath, JSON.stringify(data)).catch(() => {});
      }
    }
    // Clear cache for new file so it loads fresh
    const newCacheKey = `${vaultPath}:${name}`;
    fileCache.delete(newCacheKey);
    setActiveFile(name);
    setFiles((prev) => prev.includes(name) ? prev : [...prev, name]);
  }, [savePath, vaultPath, activeFile]);

  return (
    <div className="flex-1 flex flex-col min-w-0 animate-slide-in-right excalidraw-wrapper">
      {/* File selector header */}
      <div className="h-7 flex items-center gap-1 px-2 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        {isTauri() && files.length > 0 ? (
          <select
            value={activeFile}
            onChange={(e) => setActiveFile(e.target.value)}
            className="text-[11px] bg-transparent text-zinc-600 dark:text-zinc-400 outline-none cursor-pointer max-w-[160px]"
          >
            {files.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        ) : (
          <span className="text-[11px] text-zinc-400">{activeFile}</span>
        )}
        <button
          onClick={() => setNewDialogOpen(true)}
          className="flex items-center gap-0.5 text-[11px] text-accent hover:text-accent-hover ml-1"
          title="新建白板"
        >
          <FaPlus size={10} /> 新建
        </button>
      </div>
      <InputDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        title="新建白板"
        placeholder="白板名称（不含扩展名）"
        confirmLabel="创建"
        onConfirm={createNew}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw
          key={`${vaultPath}:${activeFile}`}
          initialData={initialData || undefined}
          onChange={handleChange}
          theme={theme === "dark" ? "dark" : "light"}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: { saveFileToDisk: false },
            },
          }}
        />
      </div>
    </div>
  );
}
