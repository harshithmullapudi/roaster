import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { findMentions } from "./mention-matches";
import { knownMentions } from "./mention-store";

/**
 * Styles `@handle` wherever it appears as plain text.
 *
 * The Mention node only covers handles picked from the autocomplete, but most
 * real mentions never go through it: people type the handle out, and every
 * agent-written message arrives via `textToTiptap` as plain paragraphs. Slack
 * linkifies on render for the same reason, so this decorates rather than
 * rewrites — the stored document is left exactly as it was.
 */
export const mentionHighlightKey = new PluginKey("mention-highlight");

function decorate(doc: import("@tiptap/pm/model").Node): DecorationSet {
  const candidates = knownMentions();
  if (candidates.length === 0) return DecorationSet.empty;

  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;

    for (const match of findMentions(node.text, candidates)) {
      decorations.push(
        // `data-kind` matches what the Mention node renders, so a typed-out
        // handle and one picked from the autocomplete style identically.
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
          /**
           * Recomputed whenever the document changes, and on the no-op
           * transaction dispatched when the agent list finishes loading.
           */
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
