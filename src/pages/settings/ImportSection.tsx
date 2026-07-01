import { FaSpinner, FaUpload } from "react-icons/fa6";
import { InputDialog } from "@/components/ui/InputDialog";
import { useState } from "react";

export function ImportSection() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = async (path: string) => {
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("http://localhost:8710/api/v1/import/obsidian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_path: path }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`❌ ${data.error}`);
      } else {
        setResult(`✅ 导入 ${data.imported} 篇笔记，跳过 ${data.skipped} 篇，共 ${data.total_notes} 篇`);
      }
    } catch (e) {
      setResult(`❌ 请求失败：${e}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        从 Obsidian 仓库导入所有 .md 笔记文件（跳过 .obsidian 等配置）
      </p>
      <button
        onClick={() => setImportOpen(true)}
        disabled={importing}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {importing ? <FaSpinner size={16} className="animate-spin text-blue-500" /> : <FaUpload size={16} className="text-accent" />}
        导入 Obsidian 仓库
      </button>
      {result && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{result}</p>
      )}
      <InputDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入 Obsidian 仓库"
        placeholder="请输入 Obsidian 仓库的路径"
        confirmLabel="导入"
        onConfirm={handleImport}
      />
    </div>
  );
}
