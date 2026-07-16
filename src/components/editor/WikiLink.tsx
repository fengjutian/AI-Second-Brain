import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { api } from "@/lib/api";

// Note cache
let noteCache: { id: string; title: string; path: string; aliases: string[] }[] = [];
let cacheLoaded = false;

export function resetWikiLinkCache() {
  noteCache = [];
  cacheLoaded = false;
}

async function loadCache() {
  if (cacheLoaded) return;
  try {
    const notes = await api.notes.list();
    noteCache = notes.map((n: any) => ({
      id: n.id,
      title: n.title,
      path: n.path,
      aliases: n.aliases || [],
    }));
    cacheLoaded = true;
  } catch {
    // Backend not available
  }
}

function matchNotes(query: string) {
  const q = query.toLowerCase();
  return noteCache
    .filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.aliases.some((a) => a.toLowerCase().includes(q))
    )
    .slice(0, 10);
}

// ---- React Suggestion Component ----
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

interface WikiLinkItem {
  id: string;
  title: string;
  path: string;
}

const WikiLinkList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  SuggestionProps<WikiLinkItem>
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => Math.min(i + 1, props.items.length - 1));
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl overflow-hidden text-sm max-h-48 overflow-y-auto min-w-[200px]">
      {props.items.map((item, idx) => (
        <button
          key={item.id}
          className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 ${
            idx === selectedIndex
              ? "bg-accent/10 text-accent"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
          onClick={() => selectItem(idx)}
        >
          <span className="truncate font-medium">{item.title}</span>
          <span className="text-xs text-zinc-400 truncate">{item.path}</span>
        </button>
      ))}
    </div>
  );
});

WikiLinkList.displayName = "WikiLinkList";

// ---- Suggestion Config ----
export const wikiLinkSuggestion: Omit<SuggestionOptions<WikiLinkItem>, "editor"> = {
  char: "[[",
  allowSpaces: true,
  pluginKey: new PluginKey("wiki-link-suggestion"),

  items: async ({ query }) => {
    await loadCache();
    return matchNotes(query);
  },

  render: () => {
    let component: ReactRenderer | null = null;
    let popup: any = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(WikiLinkList, {
          props,
          editor: props.editor,
        });

        popup = tippy("body", {
          getReferenceClientRect: () => props.clientRect?.() || new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props) {
        component?.updateProps(props);
        popup?.setProps({
          getReferenceClientRect: () => props.clientRect?.() || new DOMRect(),
        });
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup?.hide();
          return true;
        }
        return (component?.ref as any)?.onKeyDown(props) ?? false;
      },

      onExit() {
        popup?.destroy();
        component?.destroy();
      },
    };
  },

  command: ({ editor, range, props }) => {
    // Replace [[query with [[Title]] and a space
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent(`[[${props.title}]] `)
      .run();
  },
};
