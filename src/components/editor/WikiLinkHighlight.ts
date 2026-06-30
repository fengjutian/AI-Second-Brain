import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import tippy from "tippy.js";

const WIKI_REGEX = /\[\[([^\]]+)\]\]/g;

function findWikiLinks(doc: any) {
  const decorations: Decoration[] = [];
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text = node.text || "";
    let match: RegExpExecArray | null;
    while ((match = WIKI_REGEX.exec(text)) !== null) {
      const start = pos + match.index;
      const end = start + match[0].length;
      const inner = match[1]; // "目标|显示" or "目标"
      const parts = inner.split("|");
      const target = parts[0].trim();
      const label = parts[1]?.trim() || target;

      decorations.push(
        Decoration.inline(start, end, {
          class: "wiki-link",
          nodeName: "span",
        }, {
          "data-target": target,
          "data-label": label,
        })
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

type HoverCallback = (target: string, position: { x: number; y: number }) => void;
type HideCallback = () => void;

export const WikiLinkHighlight = Extension.create({
  name: "wikiLinkHighlight",

  addOptions() {
    return {
      onHover: null as HoverCallback | null,
      onLeave: null as HideCallback | null,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const pluginKey = new PluginKey("wikiLinkHighlight");
    let currentTarget: string | null = null;
    let tooltipInstance: any = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, { doc }) {
            return findWikiLinks(doc);
          },
          apply(tr, oldDecos) {
            if (tr.docChanged) {
              return findWikiLinks(tr.doc);
            }
            return oldDecos.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state);
          },
          handleDOMEvents: {
            mouseover(view, event) {
              const target = event.target as HTMLElement;
              const wikiLink = target.closest("[data-target]");
              if (!wikiLink) return false;

              const linkTarget = wikiLink.getAttribute("data-target");
              if (!linkTarget || linkTarget === currentTarget) return false;

              if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
              currentTarget = linkTarget;

              if (options.onHover) {
                const rect = wikiLink.getBoundingClientRect();
                options.onHover(linkTarget, {
                  x: rect.left,
                  y: rect.bottom + 4,
                });
              }
              return false;
            },
            mouseout(view, event) {
              const target = event.target as HTMLElement;
              const wikiLink = target.closest("[data-target]");
              if (!wikiLink) return false;

              currentTarget = null;
              hideTimer = setTimeout(() => {
                if (options.onLeave) options.onLeave();
              }, 200);
              return false;
            },
          },
        },
      }),
    ];
  },
});
