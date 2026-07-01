import { useEffect, useState, useRef, useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWhiteboardStore } from "@/stores/whiteboardStore";
import { isTauri } from "@/lib/env";
import { FaPlus } from "react-icons/fa6";

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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const loadedRef = useRef(false);

  const savePath = vaultPath && activeFile
    ? `${vaultPath.replace(/\\/g, "/")}/.aisb/${activeFile}.excalidraw`
    : null;

  // Scan existing files
  const scanFiles = useCallback(async () => {
    if (!isTauri() || !vaultPath) return;
    const dirPath = `${vaultPath.replace(/\\/g, "/")}/.aisb`;
    const { exists, readDir, mkdir } = await import("@tauri-apps/plugin-fs");
    if (!(await exists(dirPath))) { await mkdir(dirPath).catch(() => {}); return; }
    const entries = await readDir(dirPath);
    const names = entries
      .filter((e) => e.name?.endsWith(".excalidraw"))
      .map((e) => e.name!.replace(/\.excalidraw$/, ""));
    setFiles(names.length > 0 ? names : ["whiteboard"]);
  }, [vaultPath]);

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
      saveTimerRef.current = setTimeout(() => {
        import("@tauri-apps/plugin-fs").then(({ writeTextFile }) => {
          writeTextFile(savePath, JSON.stringify(data))
            .then(() => { setSaved(true); setTimeout(() => setSaved(false), 1500); })
            .catch(() => {});
        });
      }, 2000);
    }, [savePath, vaultPath, activeFile]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const createNew = useCallback(async () => {
    const name = prompt("新白板名称（不含扩展名）：");
    if (!name) return;
    // Save current first
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); }
    if (isTauri() && savePath) {
      const cacheKey = `${vaultPath}:${activeFile}`;
      const data = fileCache.get(cacheKey);
      if (data) {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(savePath, JSON.stringify(data)).catch(() => {});
      }
    }
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
            className="text-[11px] bg-transparent text-zinc-600 dark:text-zinc-400 outline-none cursor-pointer"
          >
            {files.map((f) => (
              <option key={f} value={f}>{f}.excalidraw</option>
            ))}
          </select>
        ) : (
          <span className="text-[11px] text-zinc-400">{activeFile}.excalidraw</span>
        )}
        <button
          onClick={createNew}
          className="flex items-center gap-0.5 text-[11px] text-accent hover:text-accent-hover ml-1"
          title="新建白板"
        >
          <FaPlus size={10} /> 新建
        </button>
      </div>
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
