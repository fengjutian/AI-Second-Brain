import { useEffect, useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { isTauri } from "@/lib/env";
import { FaSpinner } from "react-icons/fa6";

interface ExcelViewerProps {
  noteId: string;
  path: string;
}

/** Convert SheetJS workbook to a 2D array suitable for Handsontable */
function sheetToData(sheet: XLSX.WorkSheet): (string | number | null)[][] {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  // Ensure every row is an array
  return raw.map((row) => {
    if (Array.isArray(row)) return row.map((c) => (c === "" ? null : c));
    return Object.values(row).map((c) => (c === "" ? null : c));
  }) as (string | number | null)[][];
}

export function ExcelViewer({ noteId, path: _path }: ExcelViewerProps) {
  const [data, setData] = useState<(string | number | null)[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hotRef = useRef<any>(null);

  const loadExcel = useCallback(async () => {
    try {
      setError(null);
      let buffer: ArrayBuffer;

      if (isTauri()) {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const contents = await readFile(noteId);
        buffer = contents.buffer.slice(
          contents.byteOffset,
          contents.byteOffset + contents.byteLength
        ) as ArrayBuffer;
      } else {
        const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/raw`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffer = await res.arrayBuffer();
      }

      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) {
        setError("工作簿中没有工作表");
        return;
      }
      setData(sheetToData(firstSheet));
    } catch (e: any) {
      setError(e?.message || "无法读取 Excel 文件");
    }
  }, [noteId]);

  useEffect(() => {
    loadExcel();
  }, [loadExcel]);

  // Lazy-load Handsontable only when we have data
  useEffect(() => {
    if (!data || !containerRef.current) return;

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
          data,
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
      }
    };
  }, [data]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <div className="text-center space-y-2">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <FaSpinner className="animate-spin text-2xl" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden" ref={containerRef} />
  );
}
