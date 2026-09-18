import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { richTextExtensions } from "./tiptap-extensions";

/**
 * A body the API parsed out of an agent's markdown. Every node here has to
 * exist in the reader's schema, or ProseMirror drops the message rather than
 * the node it cannot place.
 */
const MARKDOWN_BODY = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "Recommendation" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Cherry-pick ", marks: [{ type: "bold" }] },
        { type: "text", text: "e71d826d1", marks: [{ type: "code" }] },
        { type: "hardBreak" },
        {
          type: "text",
          text: "the ticket",
          marks: [
            { type: "link", attrs: { href: "https://example.com/SUPER-2079" } },
          ],
        },
        { type: "text", text: " is wrong", marks: [{ type: "strike" }] },
      ],
    },
    { type: "horizontalRule" },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "one" }] },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      attrs: { start: 3 },
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "three" }] },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "quoted" }] },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1;" }],
    },
  ],
};

describe("richTextExtensions", () => {
  it("parses every node a markdown body can carry", () => {
    const schema = getSchema(richTextExtensions);
    const doc = schema.nodeFromJSON(MARKDOWN_BODY);

    doc.check();
    expect(doc.childCount).toBe(MARKDOWN_BODY.content.length);
    expect(doc.textContent).toContain("Recommendation");
  });
});
