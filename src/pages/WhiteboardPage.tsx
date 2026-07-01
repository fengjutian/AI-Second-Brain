import { useState, lazy, Suspense } from "react";
import { FaArrowLeft, FaSpinner } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";

type BoardMode = "tldraw" | "excalidraw";

// Lazy-load tldraw — it's ~1MB, don't block initial load
const TldrawBoard = lazy(() =>
  import("./TldrawBoard").then((m) => ({ default: m.TldrawBoard }))
);

// Placeholder for Excalidraw (install @excalidraw/excalidraw first)
const ExcalidrawBoard = lazy(() =>
  import("./ExcalidrawBoard").then((m) => ({ default: m.ExcalidrawBoard }))
);

export function WhiteboardPage() {
  const [mode, setMode] = useState<BoardMode>("tldraw");
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="h-10 flex items-center px-3 gap-3 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <FaArrowLeft size={16} className="text-zinc-400" />
        </button>
        <span className="text-sm font-medium">白板</span>

        {/* Mode switcher */}
        <div className="flex gap-1 ml-auto">
          {(["tldraw", "excalidraw"] as BoardMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                mode === m
                  ? "bg-accent text-white"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {m === "tldraw" ? "tldraw" : "Excalidraw"}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full gap-2 text-sm text-zinc-400">
              <FaSpinner size={16} className="animate-spin text-blue-500" />
              加载白板...
            </div>
          }
        >
          {mode === "tldraw" ? <TldrawBoard /> : <ExcalidrawBoard />}
        </Suspense>
      </div>
    </div>
  );
}
