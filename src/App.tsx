import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { GraphView } from "@/pages/GraphView";
import { SettingsPage } from "@/pages/SettingsPage";
import { useSettingsStore } from "@/stores/settingsStore";
import { useEffect } from "react";

export default function App() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<MainLayout />} />
      <Route path="/graph" element={<GraphView />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
