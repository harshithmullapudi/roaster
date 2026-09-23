import { Extension, mergeAttributes } from "@tiptap/core";
import Mention, { type MentionOptions } from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import StarterKit, { type StarterKitOptions } from "@tiptap/starter-kit";
import Suggestion from "@tiptap/suggestion";

import { createEmojiSuggestion } from "./emoji-suggestion";
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

const MENTION_TEXT = ({ node }: { node: { attrs: Record<string, unknown> } }) =>
  `@${node.attrs.label ?? node.attrs.id}`;

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

function mention(suggestion?: ReturnType<typeof createMentionSuggestion>) {
  return MentionWithKind.configure({
    HTMLAttributes: { class: "mention" },
    renderText: MENTION_TEXT,
    ...(suggestion ? { suggestion } : {}),
  });
}

const EmojiSuggestion = Extension.create({
  name: "emojiSuggestion",

  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...createEmojiSuggestion() })];
  },
});

/*
 * Stock renderHTML measures column widths off a live ProseMirror node, which
 * the static renderer never has — it only holds the stored JSON, so the
 * colgroup came out empty and took the rows with it. Widths are moot here
 * anyway: the table is read-only and no cell carries a colwidth.
 */
const PlainTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      "table",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ["tbody", 0],
    ];
  },
});

const tableExtensions = [
  PlainTable.configure({
    resizable: false,
    HTMLAttributes: {
      class: "my-1 block w-max max-w-full overflow-x-auto border-collapse",
    },
  }),
  TableRow,
  TableHeader.configure({
    HTMLAttributes: {
      class: "border-border bg-grayAlpha-100 border px-2 py-1 text-left align-top font-medium",
    },
  }),
  TableCell.configure({
    HTMLAttributes: { class: "border-border border px-2 py-1 align-top" },
  }),
];

export const richTextExtensions = [
  readOnlyStarterKit,
  mention(),
  MentionHighlight,
  ...tableExtensions,
];

export function composerExtensions(
  placeholder: string,
  getMentions?: () => MentionItem[],
) {
  return [
    starterKit,
    MentionHighlight,
    mention(getMentions ? createMentionSuggestion(getMentions) : undefined),
    EmojiSuggestion,
    Placeholder.configure({
      placeholder,
      includeChildren: true,
      emptyNodeClass: "is-editor-empty",
      emptyEditorClass: "is-editor-empty",
    }),
  ];
}
