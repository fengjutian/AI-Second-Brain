import { FaArrowLeft, FaGear, FaBrain, FaBox, FaDownload } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { GeneralSection } from "@/pages/settings/GeneralSection";
import { AiSection } from "@/pages/settings/AiSection";
import { PluginSection } from "@/pages/settings/PluginSection";
import { ImportSection } from "@/pages/settings/ImportSection";

const TABS = [
  { id: "general", label: "常规", icon: FaGear },
  { id: "ai", label: "AI 设置", icon: FaBrain },
  { id: "plugins", label: "插件", icon: FaBox },
  { id: "import", label: "导入", icon: FaDownload },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center px-4 gap-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
        <button onClick={() => navigate("/")} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <FaArrowLeft size={18} className="text-zinc-400" />
        </button>
        <span className="font-medium">设置</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors",
              activeTab === id
                ? "border-accent text-accent"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-8 space-y-8 overflow-y-auto">
        {activeTab === "general" && <GeneralSection />}
        {activeTab === "ai" && <AiSection />}
        {activeTab === "plugins" && (
          <section>
            <h3 className="text-sm font-medium mb-3">插件</h3>
            <PluginSection />
          </section>
        )}
        {activeTab === "import" && (
          <section>
            <h3 className="text-sm font-medium mb-3">导入</h3>
            <ImportSection />
          </section>
        )}
      </div>
    </div>
  );
}
