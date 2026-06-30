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
  notes: Map<string, Note>;        // cache: id → Note
  currentId: string | null;
  isDirty: boolean;
  loadNote: (id: string, note: Note) => void;
  setCurrent: (id: string | null) => void;
  setContent: (id: string, content: string) => void;
  setDirty: (d: boolean) => void;
  removeNote: (id: string) => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: new Map(),
  currentId: null,
  isDirty: false,

  loadNote: (id, note) =>
    set((s) => {
      const next = new Map(s.notes);
      next.set(id, note);
      return { notes: next, currentId: id, isDirty: false };
    }),

  setCurrent: (id) => set({ currentId: id }),

  setContent: (id, content) =>
    set((s) => {
      const note = s.notes.get(id);
      if (!note) return s;
      const next = new Map(s.notes);
      next.set(id, { ...note, content });
      return { notes: next, isDirty: true };
    }),

  setDirty: (d) => set({ isDirty: d }),

  removeNote: (id) =>
    set((s) => {
      const next = new Map(s.notes);
      next.delete(id);
      return { notes: next };
    }),
}));
