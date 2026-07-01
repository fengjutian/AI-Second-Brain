import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { FaSpinner } from "react-icons/fa6";
import { api } from "@/lib/api";

export function GraphPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
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
            "font-size": "10px",
            "text-valign": "center",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#a1a1aa",
            "target-arrow-color": "#a1a1aa",
            "target-arrow-shape": "triangle",
          },
        },
      ],
      layout: { name: "cose" },
    });
    cyRef.current = cy;

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
        setError("无法加载图谱");
        setLoading(false);
      });

    return () => {
      mounted = false;
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {loading && (
        <div className="flex items-center justify-center py-4 gap-2 text-xs text-zinc-400">
          <FaSpinner size={12} className="animate-spin text-blue-500" />
          加载中...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-4 text-xs text-zinc-400">
          {error}
        </div>
      )}
      <div ref={containerRef} className="flex-1 graph-container min-h-0" />
    </div>
  );
}
