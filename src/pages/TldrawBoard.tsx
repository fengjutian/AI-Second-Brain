import { FaDownload, FaSpinner } from "react-icons/fa6";

export function TldrawBoard() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <p className="text-zinc-500 dark:text-zinc-400 text-lg">tldraw 白板</p>
        <p className="text-sm text-zinc-400">
          tldraw 需要 TipTap v3，与当前项目的 TipTap v2 存在版本冲突。
        </p>
        <div className="text-xs text-zinc-500 space-y-1">
          <p>解决方案（选一）：</p>
          <code className="inline-block px-3 py-2 text-xs bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 text-left">
            1. 升级项目 TipTap 到 v3: pnpm up @tiptap/core@latest<br />
            2. 安装 tldraw: pnpm add @tldraw/tldraw
          </code>
        </div>
      </div>
    </div>
  );
}
