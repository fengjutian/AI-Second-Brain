import { useState, useRef, useEffect } from "react";
import { Dialog } from "@/components/ui/Dialog";

interface InputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
}

export function InputDialog({
  open,
  onOpenChange,
  title,
  placeholder = "",
  defaultValue = "",
  confirmLabel = "确定",
  onConfirm,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay to ensure the dialog has mounted before focusing
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      setValue(defaultValue);
      return () => clearTimeout(timer);
    }
  }, [open, defaultValue]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return; // Don't allow empty input
    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleConfirm();
          if (e.key === "Escape") onOpenChange(false);
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors mb-4"
      />
      <div className="flex justify-end gap-3">
        <button
          className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => onOpenChange(false)}
        >
          取消
        </button>
        <button
          className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          onClick={handleConfirm}
          disabled={!value.trim()}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
