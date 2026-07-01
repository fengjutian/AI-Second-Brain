import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export function ExcalidrawBoard() {
  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Excalidraw />
    </div>
  );
}
