import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, children, className }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700",
            "w-full max-w-md p-6",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            className,
          )}
        >
          {title && (
            <DialogPrimitive.Title className="text-lg font-semibold mb-4">
              {title}
            </DialogPrimitive.Title>
          )}
          <DialogPrimitive.Close className="absolute top-4 right-4 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={16} />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ---- Confirm Dialog ----
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: "default" | "danger";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "确定",
  onConfirm,
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          onClick={() => onOpenChange(false)}
        >
          取消
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm rounded-lg text-white transition-colors",
            variant === "danger"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-accent hover:bg-accent-hover",
          )}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

// ---- Alert Dialog (replaces alert()) ----
interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
}

export function AlertDialog({ open, onOpenChange, title, message }: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{message}</p>
      <div className="flex justify-end">
        <button
          className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
          onClick={() => onOpenChange(false)}
        >
          确定
        </button>
      </div>
    </Dialog>
  );
}
