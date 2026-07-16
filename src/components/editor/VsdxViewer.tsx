import { useEffect, useState, useCallback, useRef } from "react";
import { isTauri } from "@/lib/env";
import { FaSpinner } from "react-icons/fa6";

interface VsdxViewerProps {
  noteId: string;
  path: string;
}

const DRAWIO_EMBED_URL =
  "https://embed.diagrams.net/?embed=1&proto=json&spin=1&noSaveBtn=1&noExitBtn=1&saveAndExit=0&libraries=0";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function VsdxViewer({ noteId }: VsdxViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [base64, setBase64] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef(false);

  // Load VSDX as base64
  const loadVsdx = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      loadedRef.current = false;

      let buffer: ArrayBuffer;

      if (isTauri()) {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const contents = await readFile(noteId);
        buffer = contents.buffer.slice(
          contents.byteOffset,
          contents.byteOffset + contents.byteLength
        );
      } else {
        const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/raw`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffer = await res.arrayBuffer();
      }

      setBase64(arrayBufferToBase64(buffer));
      setLoading(false);
    } catch (e: any) {
      console.error("VSDX load error:", e);
      setError(e?.message || "无法读取 VSDX 文件");
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadVsdx();
  }, [loadVsdx]);

  // Send the VSDX data to draw.io when both iframe and base64 are ready
  useEffect(() => {
    if (!base64 || !iframeRef.current || loadedRef.current) return;

    const handler = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;

      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.event === "init") {
        loadedRef.current = true;
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({
            action: "load",
            autosave: 0,
            xml: `data:application/vnd.visio;base64,${base64}`,
          }),
          "*"
        );
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [base64]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <div className="text-center space-y-2">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 bg-white dark:bg-zinc-900 z-10">
          <FaSpinner className="animate-spin text-2xl" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={DRAWIO_EMBED_URL}
        className="h-full w-full border-0"
        title="VSDX Viewer"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
