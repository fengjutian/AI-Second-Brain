import { create } from "zustand";

export interface Note {
  id: string;
  path: string;
  title: string;
  content: string;
  tags: string[];
  aliases: string[];
  created: string;
  updated: string;
}

interface NoteState {
  notes: Record<string, Note>; // cache: id → Note — Record avoids full-re-render on single-note edits
  currentId: string | null;
  isDirty: boolean;
  loadNote: (id: string, note: Note) => void;
  setCurrent: (id: string | null) => void;
  setContent: (id: string, content: string) => void;
  setDirty: (d: boolean) => void;
  removeNote: (id: string) => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: {},
  currentId: null,
  isDirty: false,

  loadNote: (id, note) =>
    set((s) => ({
      notes: { ...s.notes, [id]: note },
      currentId: id,
      isDirty: false,
    })),

  setCurrent: (id) => set({ currentId: id }),

  setContent: (id, content) =>
    set((s) => {
      const note = s.notes[id];
      if (!note) return {};
      return {
        notes: { ...s.notes, [id]: { ...note, content } },
        isDirty: true,
      };
    }),

  setDirty: (d) => set({ isDirty: d }),

  removeNote: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.notes;
      return { notes: rest };
    }),
}));
