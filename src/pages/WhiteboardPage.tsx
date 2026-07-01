import { lazy, Suspense } from "react";
import { FaArrowLeft, FaSpinner } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";

const ExcalidrawBoard = lazy(() =>
  import("./ExcalidrawBoard").then((m) => ({ default: m.ExcalidrawBoard }))
);

export function WhiteboardPage() {
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
          <ExcalidrawBoard />
        </Suspense>
      </div>
    </div>
  );
}
