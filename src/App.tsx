import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/MainLayout";
import { GraphView } from "@/pages/GraphView";
import { SettingsPage } from "@/pages/SettingsPage";
import { WhiteboardPage } from "@/pages/WhiteboardPage";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePluginStore } from "@/stores/pluginStore";
import { useTabStore } from "@/stores/tabStore";
import { useNoteStore } from "@/stores/noteStore";
import { DailyReviewPlugin } from "@/plugins/daily-review";
import { WordCountPlugin } from "@/plugins/word-count";
import { MarkdownFormatPlugin } from "@/plugins/markdown-format";
import { api } from "@/lib/api";
import { useEffect } from "react";

export default function App() {
  const theme = useSettingsStore((s) => s.theme);
  const vaultPath = useSettingsStore((s) => s.vaultPath);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Plugin system — register core plugins when vault opens
  useEffect(() => {
    if (!vaultPath) return;

    const pluginStore = usePluginStore.getState();

    // Register core plugins (always enabled)
    pluginStore.registerCorePlugin(DailyReviewPlugin);
    pluginStore.registerCorePlugin(WordCountPlugin);
    pluginStore.registerCorePlugin(MarkdownFormatPlugin);

    // Activate all
    pluginStore.activateAll();

    return () => {
      pluginStore.deactivateAll();
    };
  }, [vaultPath]);

  // Listen for plugin "open-note" events
  useEffect(() => {
    const loadNote = useNoteStore.getState().loadNote;
    const openTab = useTabStore.getState().openTab;

    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        try {
          const note = await api.notes.get(detail.id);
          loadNote(note.id, note);
          openTab({ noteId: note.id, title: note.title, path: note.path });
        } catch {}
      }
    };

    window.addEventListener("app:open-note", handler);
    return () => window.removeEventListener("app:open-note", handler);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<MainLayout />} />
      <Route path="/graph" element={<GraphView />} />
      <Route path="/whiteboard" element={<WhiteboardPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
