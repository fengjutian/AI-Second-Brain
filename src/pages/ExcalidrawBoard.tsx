import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useSettingsStore } from "@/stores/settingsStore";
import { isTauri } from "@/lib/env";
import { useCallback, useEffect, useRef, useState } from "react";

const BOARD_FILE = "whiteboard.excalidraw";

export function ExcalidrawBoard() {
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const [initialData, setInitialData] = useState<{
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const filePathRef = useRef<string>("");
  const sceneRef = useRef<{ elements: readonly ExcalidrawElement[]; appState: AppState } | null>(null);
  const savingRef = useRef(false);

  // Actual save to disk
  const saveToFile = useCallback(async (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    filePath: string,
  ) => {
    const data = JSON.stringify({ elements, appState });
    try {
      if (isTauri()) {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(filePath, data);
      } else {
        localStorage.setItem(`excalidraw:${BOARD_FILE}`, data);
      }
    } catch {}
  }, []);

  // Load board file on mount
  useEffect(() => {
    if (!vaultPath) return;

    const filePath = `${vaultPath.replace(/\\/g, "/")}/${BOARD_FILE}`;
    filePathRef.current = filePath;

    const load = async () => {
      try {
        if (isTauri()) {
          const { readTextFile } = await import("@tauri-apps/plugin-fs");
          const raw = await readTextFile(filePath);
          const data = JSON.parse(raw);
          setInitialData({
            elements: data.elements || [],
            appState: data.appState || {},
            files: {},
          });
        } else {
          const raw = localStorage.getItem(`excalidraw:${BOARD_FILE}`);
          if (raw) {
            const data = JSON.parse(raw);
            setInitialData({
              elements: data.elements || [],
              appState: data.appState || {},
              files: {},
            });
          }
        }
      } catch {
        // File doesn't exist yet — start with empty board
      }
      setLoaded(true);
    };

    load();
  }, [vaultPath]);

  // Intercept Ctrl+S to save to vault path instead of browser download
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();
        if (sceneRef.current && filePathRef.current && !savingRef.current) {
          savingRef.current = true;
          saveToFile(sceneRef.current.elements, sceneRef.current.appState, filePathRef.current)
            .finally(() => { savingRef.current = false; });
        }
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [saveToFile]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, _files: BinaryFiles) => {
      if (!loaded || !filePathRef.current) return;

      sceneRef.current = { elements, appState };

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveToFile(elements, appState, filePathRef.current);
      }, 1500);
    },
    [loaded, saveToFile]
  );

  // Cleanup pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Excalidraw
        initialData={initialData || undefined}
        onChange={handleChange}
      />
    </div>
  );
}
