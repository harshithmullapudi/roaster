import { loadedEmojis, loadEmojis } from "@roster/ui";
import { PluginKey } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";

import {
  EmojiList,
  type EmojiListHandle,
} from "~/components/messages/emoji-list";

import { type EmojiItem, filterEmojis, parseEmojiQuery } from "./emojis";
import { placeSuggestion } from "./suggestion-position";

export const emojiPluginKey = new PluginKey<{ active: boolean }>(
  "emojiSuggestion",
);

const openEditors = new WeakSet<Editor>();

export function isEmojiSuggestionOpen(editor: Editor | null): boolean {
  return editor ? openEditors.has(editor) : false;
}

export function createEmojiSuggestion(): Omit<
  SuggestionOptions<EmojiItem, EmojiItem>,
  "editor"
> {
  return {
    char: ":",
    pluginKey: emojiPluginKey,
    allowToIncludeChar: true,
    allowedPrefixes: [" "],

    items: async ({ query }) => {
      const parsed = parseEmojiQuery(query);
      if (!parsed) return [];

      const entries = loadedEmojis() ?? (await loadEmojis());
      return filterEmojis(entries, parsed);
    },

    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, `${props.unicode} `)
        .run();
    },

    render: () => {
      let renderer: ReactRenderer<EmojiListHandle> | null = null;
      let editor: Editor | null = null;

      function close() {
        if (editor) openEditors.delete(editor);
        renderer?.element.remove();
        renderer?.destroy();
        renderer = null;
        editor = null;
      }

      return {
        onStart: (props) => {
          editor = props.editor as Editor;
          renderer = new ReactRenderer(EmojiList, { props, editor });

          const element = renderer.element as HTMLElement;
          document.body.appendChild(element);
          placeSuggestion(element, props.clientRect?.() ?? null);

          if (props.items.length > 0) openEditors.add(editor);
        },

        onUpdate: (props) => {
          renderer?.updateProps(props);
          if (renderer) {
            placeSuggestion(
              renderer.element as HTMLElement,
              props.clientRect?.() ?? null,
            );
          }

          if (editor) {
            if (props.items.length > 0) openEditors.add(editor);
            else openEditors.delete(editor);
          }
        },

        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            close();
            return true;
          }
          return renderer?.ref?.onKeyDown(props.event) ?? false;
        },

        onExit: close,
      };
    },
  };
}
