import { useEffect, useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { isTauri } from "@/lib/env";
import { FaSpinner } from "react-icons/fa6";

interface ExcelViewerProps {
  noteId: string;
  path: string;
}

/** Convert SheetJS worksheet to a 2D array suitable for Handsontable */
function sheetToData(sheet: XLSX.WorkSheet): (string | number | null)[][] {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  return raw.map((row) => {
    if (Array.isArray(row)) return row.map((c) => (c === "" ? null : c));
    return Object.values(row).map((c) => (c === "" ? null : c));
  }) as (string | number | null)[][];
}

export function ExcelViewer({ noteId, path: _path }: ExcelViewerProps) {
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetsData, setSheetsData] = useState<Record<string, (string | number | null)[][]>>({});
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hotReady, setHotReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hotRef = useRef<any>(null);

  // Load workbook and parse all sheets
  const loadExcel = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      let workbook: XLSX.WorkBook;

      if (isTauri()) {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const contents = await readFile(noteId);
        workbook = XLSX.read(contents, { type: "array" });
      } else {
        const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/raw`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      }

      const names = workbook.SheetNames;
      if (!names.length) {
        setError("工作簿中没有工作表");
        setLoading(false);
        return;
      }

      const dataMap: Record<string, (string | number | null)[][]> = {};
      for (const name of names) {
        dataMap[name] = sheetToData(workbook.Sheets[name]);
      }

      setSheetNames(names);
      setSheetsData(dataMap);
      setActiveSheet(names[0]);
      setLoading(false);
    } catch (e: any) {
      console.error("Excel load error:", e);
      setError(e?.message || "无法读取 Excel 文件");
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadExcel();
  }, [loadExcel]);

  // Destroy Handsontable when switching files
  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.destroy();
      hotRef.current = null;
      setHotReady(false);
    }
  }, [noteId]);

  // Initialize Handsontable once when first sheet data arrives
  useEffect(() => {
    if (!activeSheet || !sheetsData[activeSheet] || !containerRef.current || hotRef.current) return;

    let cancelled = false;

    const init = async () => {
      try {
        await import("handsontable/dist/handsontable.full.min.css");
        const HandsontableModule = await import("handsontable");

        if (cancelled) return;

        const Handsontable = HandsontableModule.default;
        const container = containerRef.current!;
        container.innerHTML = "";

        hotRef.current = new Handsontable(container, {
          data: sheetsData[activeSheet],
          rowHeaders: true,
          colHeaders: true,
          height: "100%",
          width: "100%",
          licenseKey: "non-commercial-and-evaluation",
          readOnly: false,
          stretchH: "all",
          contextMenu: true,
          dropdownMenu: true,
          filters: true,
          columnSorting: true,
          wordWrap: false,
          autoWrapRow: true,
          autoWrapCol: true,
        });
        if (!cancelled) setHotReady(true);
      } catch (e) {
        if (!cancelled) setError("Handsontable 加载失败");
      }
    };

    init();

    return () => {
      cancelled = true;
      if (hotRef.current) {
        hotRef.current.destroy();
        hotRef.current = null;
        setHotReady(false);
      }
    };
  // Only init on first data arrival; sheet switches use loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!activeSheet && !!sheetsData[activeSheet]]);

  // Switch sheet data without recreating Handsontable
  const switchSheet = useCallback((name: string) => {
    setActiveSheet(name);
    if (hotRef.current && sheetsData[name]) {
      hotRef.current.loadData(sheetsData[name]);
    }
  }, [sheetsData]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <div className="text-center space-y-2">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !hotReady) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <FaSpinner className="animate-spin text-2xl" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Sheet tabs */}
      {sheetNames.length > 1 && (
        <div className="flex items-center gap-0.5 px-1 py-1 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 shrink-0 overflow-x-auto">
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => switchSheet(name)}
              className={`shrink-0 px-3 py-1 text-xs rounded-t-md transition-colors border border-b-0 ${
                name === activeSheet
                  ? "bg-white dark:bg-zinc-800 text-accent border-zinc-200 dark:border-zinc-700 font-medium"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-800/60 border-transparent"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {/* Handsontable container */}
      <div className="flex-1 w-full overflow-hidden" ref={containerRef} />
    </div>
  );
}
