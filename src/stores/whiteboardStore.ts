import { create } from "zustand";

interface WhiteboardState {
  savePath: string | null;
  saved: boolean;
  setSavePath: (path: string | null) => void;
  setSaved: (saved: boolean) => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set) => ({
  savePath: null,
  saved: false,
  setSavePath: (path) => set({ savePath: path, saved: false }),
  setSaved: (saved) => set({ saved }),
}));
