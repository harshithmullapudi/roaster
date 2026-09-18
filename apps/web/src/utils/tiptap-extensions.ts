import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit, { type StarterKitOptions } from "@tiptap/starter-kit";

import { MentionHighlight } from "./mention-highlight";
import { createMentionSuggestion } from "./mention-suggestion";
import type { MentionItem } from "./mentions";

const SHARED: Partial<StarterKitOptions> = {
  heading: false,
  horizontalRule: false,
  gapcursor: false,
  dropcursor: false,
  paragraph: {
    HTMLAttributes: { class: "paragraph-node leading-[22px]" },
  },
  bulletList: {
    HTMLAttributes: { class: "list-disc list-outside pl-5 my-1" },
  },
  orderedList: {
    HTMLAttributes: { class: "list-decimal list-outside pl-5 my-1" },
  },
  listItem: { HTMLAttributes: { class: "mt-0.5" } },
  blockquote: {
    HTMLAttributes: { class: "border-border border-l-2 pl-2" },
  },
  code: {
    HTMLAttributes: {
      class:
        "bg-grayAlpha-100 text-muted-foreground rounded px-1 py-0 font-mono text-sm",
      spellcheck: "false",
    },
  },
  codeBlock: {
    HTMLAttributes: {
      class:
        "bg-grayAlpha-100 border-border my-1 rounded-md border p-2 font-mono text-sm",
    },
  },
  link: {
    HTMLAttributes: { class: "text-primary cursor-pointer underline" },
    openOnClick: false,
    autolink: true,
  },
};

const starterKit = StarterKit.configure(SHARED);

/**
 * Agent replies are markdown, parsed into a body on the way in, so the reader
 * needs the two nodes the composer deliberately does without. They stay off in
 * the composer: a chat box that turns `## ` into a heading as you type is a
 * surprise nobody asked for.
 */
const readOnlyStarterKit = StarterKit.configure({
  ...SHARED,
  heading: {
    levels: [1, 2, 3],
    HTMLAttributes: { class: "heading-node" },
  },
  horizontalRule: {
    HTMLAttributes: { class: "border-border my-2 border-t" },
  },
});

/**
 * `renderText` matters more than it looks: `messages.text` is handed to the
 * agent verbatim as its prompt, so a mention that does not survive into the
 * plain text is a mention the agent never sees.
 */
const MENTION_TEXT = ({ node }: { node: { attrs: Record<string, unknown> } }) =>
  `@${node.attrs.label ?? node.attrs.id}`;

/**
 * Read-only mention: the node must exist wherever bodies are rendered, or a
 * stored message containing one fails to parse. `message-body` reads from
 * `richTextExtensions`, so the node lives here and the popup does not.
 */
export const richTextExtensions = [
  readOnlyStarterKit,
  Mention.configure({
    HTMLAttributes: { class: "mention" },
    renderText: MENTION_TEXT,
  }),
  MentionHighlight,
];

export function composerExtensions(
  placeholder: string,
  getMentions?: () => MentionItem[],
) {
  return [
    starterKit,
    MentionHighlight,
    Mention.configure({
      HTMLAttributes: { class: "mention" },
      renderText: MENTION_TEXT,
      ...(getMentions
        ? { suggestion: createMentionSuggestion(getMentions) }
        : {}),
    }),
    Placeholder.configure({
      placeholder,
      includeChildren: true,
      emptyNodeClass: "is-editor-empty",
      emptyEditorClass: "is-editor-empty",
    }),
  ];
}
