import { useState, useEffect } from "react";
import { FaDownload, FaSpinner } from "react-icons/fa6";

let ExcalidrawComponent: any = null;

export function ExcalidrawBoard() {
  const [status, setStatus] = useState<"loading" | "loaded" | "unavailable">("loading");

  useEffect(() => {
    if (ExcalidrawComponent) {
      setStatus("loaded");
      return;
    }
    // Dynamic import — only executes at runtime, won't fail build
    new Function("return import('@excalidraw/excalidraw')")()
      .then((mod: any) => {
        ExcalidrawComponent = mod.Excalidraw || mod.default;
        setStatus("loaded");
      })
      .catch(() => setStatus("unavailable"));
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-sm text-zinc-400">
        <FaSpinner size={16} className="animate-spin text-blue-500" />
        加载白板...
      </div>
    );
  }

  if (status === "unavailable" || !ExcalidrawComponent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <FaDownload size={32} className="mx-auto text-zinc-300" />
          <p className="text-zinc-500 dark:text-zinc-400">Excalidraw 未安装</p>
          <code className="inline-block px-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">
            pnpm add @excalidraw/excalidraw
          </code>
          <p className="text-xs text-zinc-400">安装后即可用手绘风格白板</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ExcalidrawComponent />
    </div>
  );
}
