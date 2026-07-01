import { Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

export function TldrawBoard() {
  return (
    <div className="h-full w-full">
      <Tldraw persistenceKey="ai-second-brain-tldraw" />
    </div>
  );
}
