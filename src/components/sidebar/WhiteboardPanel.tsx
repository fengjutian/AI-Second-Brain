import { Excalidraw } from "@excalidraw/excalidraw";

export function WhiteboardPanel() {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 animate-slide-in-right">
      <div className="flex-1 min-h-0">
        <Excalidraw />
      </div>
    </div>
  );
}
