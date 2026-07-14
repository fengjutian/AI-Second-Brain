import { useTabStore } from "@/stores/tabStore";
import { Editor } from "@/components/editor/Editor";
import { ExcelViewer } from "@/components/editor/ExcelViewer";
import { PdfViewer } from "@/components/editor/PdfViewer";
import { ImageViewer } from "@/components/editor/ImageViewer";
import { CodeViewer } from "@/components/editor/CodeViewer";
import { FaXmark } from "react-icons/fa6";
import { cn } from "@/lib/utils";

const EXCEL_EXTENSIONS = /\.(xlsx|xls|xlsm|csv|tsv)$/i;
const PDF_EXTENSIONS = /\.pdf$/i;
const IMAGE_EXTENSIONS = /\.(png|jpe?g|svg|gif|webp|bmp|ico)$/i;
const CODE_EXTENSIONS = /\.(js|jsx|ts|tsx|py|rs|go|java|c|cpp|h|hpp|rb|php|swift|kt|scala|r|lua|sh|bash|zsh|fish|ps1|bat|cmd|sql|graphql|json|yaml|yml|toml|xml|html|css|scss|less|vue|svelte|astro|txt|log|env|cfg|ini|conf|Makefile|Dockerfile|nginx\.conf)$/i;

export function TabManager() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActive = useTabStore((s) => s.setActive);
  const closeTab = useTabStore((s) => s.closeTab);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
        <div className="text-center space-y-2">
          <p className="text-lg">Rainstone</p>
          <p className="text-sm">Ctrl+N 新建笔记 ｜ Ctrl+P 命令面板</p>
        </div>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const isExcel = activeTab && EXCEL_EXTENSIONS.test(activeTab.path);
  const isPdf = activeTab && PDF_EXTENSIONS.test(activeTab.path);
  const isImage = activeTab && IMAGE_EXTENSIONS.test(activeTab.path);
  const isCode = activeTab && CODE_EXTENSIONS.test(activeTab.path);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab Bar */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto shrink-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-r border-zinc-200 dark:border-zinc-700 min-w-0 max-w-48 transition-colors select-none",
              tab.id === activeTabId
                ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
            )}
            onClick={() => setActive(tab.id)}
          >
            <span className="truncate flex-1 text-xs">{tab.title || "未命名"}</span>
            {tab.isDirty && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <FaXmark size={12} className="text-zinc-400" />
            </button>
          </div>
        ))}
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab && isExcel ? (
          <ExcelViewer key={activeTab.id} noteId={activeTab.noteId} path={activeTab.path} />
        ) : activeTab && isPdf ? (
          <PdfViewer key={activeTab.id} noteId={activeTab.noteId} path={activeTab.path} />
        ) : activeTab && isImage ? (
          <ImageViewer key={activeTab.id} noteId={activeTab.noteId} path={activeTab.path} />
        ) : activeTab && isCode ? (
          <CodeViewer key={activeTab.id} noteId={activeTab.noteId} path={activeTab.path} />
        ) : activeTab ? (
          <Editor key={activeTab.id} tabId={activeTab.id} noteId={activeTab.noteId} />
        ) : null}
      </div>
    </div>
  );
}
