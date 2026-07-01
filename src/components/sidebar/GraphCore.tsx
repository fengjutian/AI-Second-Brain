import { useEffect, useRef, useState, useCallback } from "react";
import cytoscape from "cytoscape";
import { FaSpinner, FaPlus, FaMinus, FaExpand } from "react-icons/fa6";
import { api } from "@/lib/api";

interface GraphCoreProps {
  /** Node label font size (default 10) */
  fontSize?: number;
  /** Edge line width (default 1.5) */
  edgeWidth?: number;
}

export function GraphCore({ fontSize = 10, edgeWidth = 1.5 }: GraphCoreProps) {
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
            "font-size": `${fontSize}px`,
            "text-valign": "center",
          },
        },
        {
          selector: "edge",
          style: {
            width: edgeWidth,
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
        // Layout with fit to center nodes in the viewport
        cy.layout({ name: "cose", fit: true, animate: true, animationDuration: 500 }).run();
        setLoading(false);

        // Tap node → open note
        cy.on("tap", "node", (evt) => {
          const node = evt.target;
          const noteId = node.data("id");
          const label = node.data("label");
          if (noteId) {
            window.dispatchEvent(
              new CustomEvent("app:open-note", {
                detail: { id: noteId, title: label },
              })
            );
          }
        });
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
  }, [fontSize, edgeWidth]);

  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.3, renderedPosition: { x: containerRef.current!.clientWidth / 2, y: containerRef.current!.clientHeight / 2 } });
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom({ level: cyRef.current.zoom() * 0.7, renderedPosition: { x: containerRef.current!.clientWidth / 2, y: containerRef.current!.clientHeight / 2 } });
  }, []);

  const handleFit = useCallback(() => {
    cyRef.current?.fit(undefined, 50);
  }, []);

  return (
    <div className="h-full flex flex-col relative">
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

      {/* Floating toolbar — zoom + fit */}
      {!loading && !error && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
            title="放大"
          >
            <FaPlus size={14} />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
            title="缩小"
          >
            <FaMinus size={14} />
          </button>
          <button
            onClick={handleFit}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400"
            title="全览"
          >
            <FaExpand size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
