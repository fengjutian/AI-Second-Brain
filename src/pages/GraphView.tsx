import { FaArrowLeft } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { GraphCore } from "@/components/sidebar/GraphCore";

export function GraphView() {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col">
      <div className="h-12 flex items-center px-4 gap-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
        <button onClick={() => navigate("/")} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <FaArrowLeft size={18} className="text-zinc-400" />
        </button>
        <span className="font-medium">知识图谱</span>
      </div>
      <div className="flex-1">
        <GraphCore fontSize={12} edgeWidth={2} />
      </div>
    </div>
  );
}
