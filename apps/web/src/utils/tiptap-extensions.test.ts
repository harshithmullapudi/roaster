import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { richTextExtensions } from "./tiptap-extensions";

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
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Check" }] },
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "passes" }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const mentionBody = (attrs: Record<string, unknown>) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "mention", attrs }] }],
});

describe("richTextExtensions", () => {
  it("parses every node a markdown body can carry", () => {
    const schema = getSchema(richTextExtensions);
    const doc = schema.nodeFromJSON(MARKDOWN_BODY);

    doc.check();
    expect(doc.childCount).toBe(MARKDOWN_BODY.content.length);
    expect(doc.textContent).toContain("Recommendation");
  });

  it("keeps a member mention's kind through the reader's schema", () => {
    const schema = getSchema(richTextExtensions);
    const body = mentionBody({ id: "m1", label: "harshith", kind: "member" });
    const doc = schema.nodeFromJSON(body);

    doc.check();
    expect(doc.firstChild?.firstChild?.attrs).toMatchObject({
      id: "m1",
      label: "harshith",
      kind: "member",
    });
  });

  it("reads a mention written before kind existed as an agent", () => {
    const schema = getSchema(richTextExtensions);
    const doc = schema.nodeFromJSON(mentionBody({ id: "c1", label: "fern-core" }));

    expect(doc.firstChild?.firstChild?.attrs.kind).toBe("agent");
  });
});
