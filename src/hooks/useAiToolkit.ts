/**
 * useAiToolkit — AI-powered document editing hook for Tiptap.
 *
 * Provides three operations that work with the existing backend LLM:
 * - improveText(instruction)   → rewrite selected text
 * - continueWriting()          → AI continues from cursor
 * - proofread()                → correct grammar/spelling in selection or full doc
 *
 * All edits are applied as tracked changes (suggest mode) so the user
 * can review, accept, or reject each AI modification.
 */

import { useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { aiStream } from "@/lib/aiStream";

export type AiStatus = "idle" | "streaming" | "done" | "error";

interface AiState {
  status: AiStatus;
  result: string;
  error: string;
}

function buildSystemPrompt(): string {
  return `You are a precise text editor AI embedded in a note-taking app.

Rules:
- Return ONLY the edited text — no explanations, no markdown fences, no "here is the result".
- Preserve the original meaning unless the instruction says otherwise.
- Match the language of the input text unless instructed otherwise.
- For proofreading: fix grammar, spelling, and punctuation only. Do not change style.
- For continue-writing: continue naturally from where the text ends.`;
}

function buildEditPrompt(text: string, instruction: string): string {
  return `## Original text
${text}

## Instruction
${instruction}

## Edited text`;
}

function buildContinuePrompt(context: string): string {
  return `## Preceding text
${context}

## Instruction
Continue writing naturally from where this text ends. Match the style and tone.

## Continuation`;
}

function buildProofreadPrompt(text: string): string {
  return `## Original text
${text}

## Instruction
Proofread this text. Fix any grammar, spelling, or punctuation errors. Do NOT change the meaning, style, or structure. If there are no errors, return the text unchanged.

## Corrected text`;
}

export function useAiToolkit(editor: Editor | null) {
  const [state, setState] = useState<AiState>({
    status: "idle",
    result: "",
    error: "",
  });
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: "idle", result: "", error: "" });
  }, []);

  /** Rewrite the selected text (or current paragraph) according to instruction. */
  const improveText = useCallback(
    async (instruction: string) => {
      if (!editor) return;

      // Get selected text or current paragraph
      const { from, to } = editor.state.selection;
      const range = from === to
        ? { from: editor.state.selection.$from.start(), to: editor.state.selection.$from.end() }
        : { from, to };

      const originalText = editor.state.doc.textBetween(range.from, range.to, "\n");
      if (!originalText.trim()) return;

      setState({ status: "streaming", result: "", error: "" });

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        let fullResult = "";
        await aiStream(
          [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildEditPrompt(originalText, instruction) },
          ],
          (chunk) => {
            fullResult += chunk;
            setState((s) => ({ ...s, result: fullResult }));
          },
          controller.signal,
        );

        abortRef.current = null;

        if (fullResult) {
          // Apply as tracked change: delete original, insert result
          // Switch to suggest mode temporarily so changes are tracked
          const prevMode = (editor.storage as any)?.trackChanges?.mode ?? "edit";
          (editor.commands as any).setTrackChangesMode("suggest");

          editor
            .chain()
            .focus()
            .setTextSelection(range)
            .deleteSelection()
            .insertContentAt(range.from, fullResult)
            .run();

          (editor.commands as any).setTrackChangesMode(prevMode);
          setState({ status: "done", result: "", error: "" });
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setState({ status: "error", result: "", error: err?.message || "AI 请求失败" });
      }
    },
    [editor],
  );

  /** AI continues writing from the cursor position. */
  const continueWriting = useCallback(async () => {
    if (!editor) return;

    // Get context: text from start of paragraph to cursor
    const { $from } = editor.state.selection;
    const paragraphStart = $from.start();
    const cursorPos = $from.pos;
    const context = editor.state.doc.textBetween(paragraphStart, cursorPos, "\n");
    if (!context.trim()) return;

    setState({ status: "streaming", result: "", error: "" });

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      let fullResult = "";
      await aiStream(
        [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildContinuePrompt(context) },
        ],
        (chunk) => {
          fullResult += chunk;
          setState((s) => ({ ...s, result: fullResult }));
        },
        controller.signal,
      );

      abortRef.current = null;

      if (fullResult) {
        const prevMode = (editor.storage as any)?.trackChanges?.mode ?? "edit";
        (editor.commands as any).setTrackChangesMode("suggest");

        editor
          .chain()
          .focus()
          .insertContentAt(cursorPos, " " + fullResult)
          .run();

        (editor.commands as any).setTrackChangesMode(prevMode);
        setState({ status: "done", result: "", error: "" });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setState({ status: "error", result: "", error: err?.message || "AI 请求失败" });
    }
  }, [editor]);

  /** Proofread selection (or whole document). */
  const proofread = useCallback(async () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    const range = hasSelection
      ? { from, to }
      : { from: 0, to: editor.state.doc.content.size };

    const text = editor.state.doc.textBetween(range.from, range.to, "\n");
    if (!text.trim()) return;

    setState({ status: "streaming", result: "", error: "" });

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      let fullResult = "";
      await aiStream(
        [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildProofreadPrompt(text) },
        ],
        (chunk) => {
          fullResult += chunk;
          setState((s) => ({ ...s, result: fullResult }));
        },
        controller.signal,
      );

      abortRef.current = null;

      if (fullResult && fullResult !== text) {
        const prevMode = (editor.storage as any)?.trackChanges?.mode ?? "edit";
        (editor.commands as any).setTrackChangesMode("suggest");

        editor
          .chain()
          .focus()
          .setTextSelection(range)
          .deleteSelection()
          .insertContent(fullResult)
          .run();

        (editor.commands as any).setTrackChangesMode(prevMode);
      }
      setState({ status: "done", result: "", error: "" });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setState({ status: "error", result: "", error: err?.message || "AI 请求失败" });
    }
  }, [editor]);

  return {
    ...state,
    improveText,
    continueWriting,
    proofread,
    cancel,
  };
}
