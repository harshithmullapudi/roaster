import type { EditorState } from "@tiptap/pm/state";
import { PluginKey } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";

import {
  MentionList,
  type MentionListHandle,
} from "~/components/messages/mention-list";

import {
  filterMentions,
  type MentionAttrs,
  type MentionItem,
} from "./mentions";

export type { MentionItem };

function place(element: HTMLElement, rect: DOMRect | null): void {
  if (!rect) return;

  const margin = 8;
  const height = element.offsetHeight || 240;
  const width = element.offsetWidth || 280;

  const above = rect.top - height - margin;
  const below = rect.bottom + margin;

  element.style.position = "fixed";
  element.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin))}px`;
  element.style.top = `${above > margin ? above : below}px`;
  element.style.zIndex = "50";
}

export const mentionPluginKey = new PluginKey<{ active: boolean }>(
  "mentionSuggestion",
);

export function isMentionSuggestionOpen(state: EditorState): boolean {
  return mentionPluginKey.getState(state)?.active === true;
}

export function createMentionSuggestion(
  getItems: () => MentionItem[],
): Omit<SuggestionOptions<MentionItem, MentionAttrs>, "editor"> {
  return {
    char: "@",
    allowSpaces: false,
    pluginKey: mentionPluginKey,

    items: ({ query }) => filterMentions(getItems(), query),

    render: () => {
      let renderer: ReactRenderer<MentionListHandle> | null = null;

      return {
        onStart: (props) => {
          renderer = new ReactRenderer(MentionList, {
            props,
            editor: props.editor as Editor,
          });

          const element = renderer.element as HTMLElement;
          document.body.appendChild(element);
          place(element, props.clientRect?.() ?? null);
        },

        onUpdate: (props) => {
          renderer?.updateProps(props);
          if (renderer) {
            place(renderer.element as HTMLElement, props.clientRect?.() ?? null);
          }
        },

        onKeyDown: (props) => {
          if (props.event.key === "Escape") {
            renderer?.element.remove();
            renderer?.destroy();
            renderer = null;
            return true;
          }
          return renderer?.ref?.onKeyDown(props.event) ?? false;
        },

        onExit: () => {
          renderer?.element.remove();
          renderer?.destroy();
          renderer = null;
        },
      };
    },
  };
}
