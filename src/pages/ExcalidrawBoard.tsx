import { FaDownload } from "react-icons/fa6";

export function ExcalidrawBoard() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <p className="text-zinc-500 dark:text-zinc-400 text-lg">Excalidraw 白板</p>
        <p className="text-sm text-zinc-400">
          请先安装依赖：
        </p>
        <code className="inline-block px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300">
          pnpm add @excalidraw/excalidraw
        </code>
        <p className="text-xs text-zinc-400">
          安装后重新编译即可使用 Excalidraw 手绘风格白板
        </p>
      </div>
    </div>
  );
}
