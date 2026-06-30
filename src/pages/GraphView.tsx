import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
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
    cyRef.current = cy;

    // Load real graph data
    api.graph
      .global()
      .then((data) => {
        if (!mounted) return;
        if (!data.nodes) {
          setLoading(false);
          return;
        }
        cy.batch(() => {
          data.nodes.forEach((n: { id: string; label: string }) => {
            cy.add({ group: "nodes", data: { id: n.id, label: n.label } });
          });
          if (data.edges) {
            data.edges.forEach((e: { source: string; target: string; label?: string }) => {
              cy.add({
                group: "edges",
                data: { id: `${e.source}-${e.target}`, source: e.source, target: e.target, label: e.label },
              });
            });
          }
        });
        cy.layout({ name: "cose" }).run();
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        console.error("Failed to load graph:", e);
        setError("无法加载知识图谱");
        setLoading(false);
      });

    return () => {
      mounted = false;
      cy.destroy();
      cyRef.current = null;
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
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-sm text-zinc-400">
          <Loader2 size={16} className="animate-spin" />
          加载图谱...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-8 text-sm text-zinc-400">
          {error}
        </div>
      )}
      <div ref={containerRef} className="flex-1 graph-container" />
    </div>
  );
}
