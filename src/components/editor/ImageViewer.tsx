import { useEffect, useState, useCallback } from "react";
import { isTauri } from "@/lib/env";
import { FaSpinner } from "react-icons/fa6";

interface ImageViewerProps {
  noteId: string;
  path: string;
}

function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

export function ImageViewer({ noteId, path }: ImageViewerProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadImage = useCallback(async () => {
    try {
      setError(null);
      let blob: Blob;

      if (isTauri()) {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const contents = await readFile(noteId);
        blob = new Blob([contents], { type: getMimeType(path) });
      } else {
        const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/raw`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        blob = await res.blob();
      }

      const url = URL.createObjectURL(blob);
      setImgUrl(url);
    } catch (e: any) {
      console.error("Image load error:", e);
      setError(e?.message || "无法读取图片");
    }
  }, [noteId, path]);

  useEffect(() => {
    loadImage();
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [loadImage]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <div className="text-center space-y-2">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!imgUrl) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400">
        <FaSpinner className="animate-spin text-2xl" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-black/50">
      <img
        src={imgUrl}
        alt={path}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
