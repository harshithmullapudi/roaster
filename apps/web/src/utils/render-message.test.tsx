// @vitest-environment jsdom

import { generateHTML } from "@tiptap/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { renderMessageBody } from "./render-message";
import { richTextExtensions } from "./tiptap-extensions";

const RICH_BODY = {
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
        { type: "text", text: " and italic", marks: [{ type: "italic" }] },
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
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "first" }] },
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
      attrs: { language: null },
      content: [{ type: "text", text: "pnpm test" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "mention",
          attrs: { id: "agent-1", label: "harshith", kind: "agent" },
        },
        { type: "text", text: " take a look" },
      ],
    },
  ],
};

function withoutVoidSelfClose(html: string): string {
  return html.replaceAll("/>", ">");
}

function withoutSuggestionChar(html: string): string {
  return html.replaceAll(' data-mention-suggestion-char="@"', "");
}

function withLowercaseAttributeNames(html: string): string {
  return html.replaceAll("spellCheck=", "spellcheck=");
}

function normalise(html: string): string {
  return withLowercaseAttributeNames(
    withoutSuggestionChar(withoutVoidSelfClose(html)),
  );
}

describe("renderMessageBody", () => {
  it("matches the markup the editor itself serialises", () => {
    const fromEditor = generateHTML(RICH_BODY, richTextExtensions);
    const fromStatic = renderToStaticMarkup(
      renderMessageBody(RICH_BODY, "fallback"),
    );

    expect(normalise(fromStatic)).toBe(normalise(fromEditor));
  });

  it("renders plain text when a message has no stored body", () => {
    const markup = renderToStaticMarkup(renderMessageBody(null, "just text"));

    expect(markup).toContain("just text");
  });

  it("keeps content when a node type is not in the schema", () => {
    const body = {
      type: "doc",
      content: [
        {
          type: "somethingNewer",
          content: [{ type: "text", text: "still readable" }],
        },
      ],
    };

    const markup = renderToStaticMarkup(renderMessageBody(body, ""));

    expect(markup).toContain("still readable");
  });
});
