import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        { data: { id: "1", label: "笔记 A" } },
        { data: { id: "2", label: "笔记 B" } },
        { data: { id: "3", label: "笔记 C" } },
        { data: { id: "e1-2", source: "1", target: "2" } },
        { data: { id: "e2-3", source: "2", target: "3" } },
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#7c3aed",
            label: "data(label)",
            color: "#fff",
            "font-size": "12px",
            "text-valign": "center",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#a1a1aa",
            "target-arrow-color": "#a1a1aa",
            "target-arrow-shape": "triangle",
          },
        },
      ],
      layout: { name: "cose" },
    });

    return () => {
      cy.destroy();
    };
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <div className="h-12 flex items-center px-4 gap-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
        <button onClick={() => navigate("/")} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ArrowLeft size={18} />
        </button>
        <span className="font-medium">知识图谱</span>
      </div>
      <div ref={containerRef} className="flex-1 graph-container" />
    </div>
  );
}
