import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { findMentions } from "./mention-matches";
import { knownMentions } from "./mention-store";

export const mentionHighlightKey = new PluginKey("mention-highlight");

function decorate(doc: import("@tiptap/pm/model").Node): DecorationSet {
  const candidates = knownMentions();
  if (candidates.length === 0) return DecorationSet.empty;

  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;

    for (const match of findMentions(node.text, candidates)) {
      decorations.push(
        Decoration.inline(position + match.from, position + match.to, {
          class: "mention",
          "data-mention-handle": match.handle,
          "data-kind": match.kind,
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const MentionHighlight = Extension.create({
  name: "mentionHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: mentionHighlightKey,
        state: {
          init: (_config, state) => decorate(state.doc),
          apply: (transaction, previous, _old, state) =>
            transaction.docChanged || transaction.getMeta(mentionHighlightKey)
              ? decorate(state.doc)
              : previous,
        },
        props: {
          decorations(state) {
            return mentionHighlightKey.getState(state) as
              | DecorationSet
              | undefined;
          },
        },
      }),
    ];
  },
});
