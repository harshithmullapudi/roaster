import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";

export const richTextExtensions = [
  StarterKit.configure({
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
  }),
];

export function composerExtensions(placeholder: string) {
  return [
    ...richTextExtensions,
    Placeholder.configure({
      placeholder,
      includeChildren: true,
      emptyNodeClass: "is-editor-empty",
      emptyEditorClass: "is-editor-empty",
    }),
  ];
}
