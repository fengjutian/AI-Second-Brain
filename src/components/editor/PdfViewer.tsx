import { useEffect, useState, useCallback } from "react";
import { isTauri } from "@/lib/env";
import { FaSpinner } from "react-icons/fa6";

interface PdfViewerProps {
  noteId: string;
  path: string;
}

export function PdfViewer({ noteId, path: _path }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPdf = useCallback(async () => {
    try {
      setError(null);
      let blob: Blob;

      if (isTauri()) {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const contents = await readFile(noteId);
        blob = new Blob([contents], { type: "application/pdf" });
      } else {
        const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/raw`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        blob = await res.blob();
      }

      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (e: any) {
      console.error("PDF load error:", e);
      setError(e?.message || "无法读取 PDF 文件");
    }
  }, [noteId]);

  useEffect(() => {
    loadPdf();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [loadPdf]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <div className="text-center space-y-2">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <FaSpinner className="animate-spin text-2xl" />
      </div>
    );
  }

  return (
    <iframe
      src={pdfUrl}
      className="h-full w-full border-none"
      title="PDF Viewer"
    />
  );
}
