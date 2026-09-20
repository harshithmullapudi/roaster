import Mention, { type MentionOptions } from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit, { type StarterKitOptions } from "@tiptap/starter-kit";

import { MentionHighlight } from "./mention-highlight";
import { createMentionSuggestion } from "./mention-suggestion";
import type { MentionAttrs, MentionItem } from "./mentions";

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
 * `@harshith` is a person and `@harshith-roster` is their agent — the handle
 * alone cannot say which, so the node carries the answer.
 *
 * Tiptap's `MentionNodeAttrs` is `{id, label}` and the schema drops anything
 * it does not declare, so `kind` has to be declared here or it never survives
 * the round trip. It persists as `data-kind` because that is also what the
 * stylesheet reads.
 *
 * Absent means "agent": every mention node written before people could be
 * mentioned is an agent mention, so the default is correct by construction.
 */
const MentionWithKind = Mention.extend<MentionOptions<MentionItem, MentionAttrs>>({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: "agent",
        parseHTML: (element) => element.getAttribute("data-kind") ?? "agent",
        renderHTML: (attributes) => ({ "data-kind": attributes.kind }),
      },
    };
  },
});

/**
 * One configure() for both editors. The read-only one renders stored bodies,
 * so a node whose attributes it cannot parse takes the whole message down with
 * it — the two schemas must not drift.
 */
function mention(suggestion?: ReturnType<typeof createMentionSuggestion>) {
  return MentionWithKind.configure({
    HTMLAttributes: { class: "mention" },
    renderText: MENTION_TEXT,
    ...(suggestion ? { suggestion } : {}),
  });
}

/**
 * Read-only mention: the node must exist wherever bodies are rendered, or a
 * stored message containing one fails to parse. `message-body` reads from
 * `richTextExtensions`, so the node lives here and the popup does not.
 */
export const richTextExtensions = [
  readOnlyStarterKit,
  mention(),
  MentionHighlight,
];

export function composerExtensions(
  placeholder: string,
  getMentions?: () => MentionItem[],
) {
  return [
    starterKit,
    MentionHighlight,
    mention(getMentions ? createMentionSuggestion(getMentions) : undefined),
    Placeholder.configure({
      placeholder,
      includeChildren: true,
      emptyNodeClass: "is-editor-empty",
      emptyEditorClass: "is-editor-empty",
    }),
  ];
}
