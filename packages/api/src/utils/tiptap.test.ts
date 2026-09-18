import { describe, expect, it } from "vitest";

import { markdownToTiptap } from "./tiptap";

describe("markdownToTiptap", () => {
  it("turns a heading into a heading node", () => {
    expect(markdownToTiptap("## What isn't").content[0]).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "What isn't" }],
    });
  });

  it("clamps a heading deeper than the schema allows", () => {
    const [node] = markdownToTiptap("##### deep").content;
    expect(node?.attrs).toEqual({ level: 3 });
  });

  it("marks bold, italic, strikethrough and code spans", () => {
    const [paragraph] = markdownToTiptap(
      "**Phase A** is *late*, ~~again~~, see `contentCacheMaxBytes`.",
    ).content;

    expect(paragraph?.content).toEqual([
      { type: "text", text: "Phase A", marks: [{ type: "bold" }] },
      { type: "text", text: " is " },
      { type: "text", text: "late", marks: [{ type: "italic" }] },
      { type: "text", text: ", " },
      { type: "text", text: "again", marks: [{ type: "strike" }] },
      { type: "text", text: ", see " },
      {
        type: "text",
        text: "contentCacheMaxBytes",
        marks: [{ type: "code" }],
      },
      { type: "text", text: "." },
    ]);
  });

  it("keeps the source text of a code span, not its HTML escaping", () => {
    const [paragraph] = markdownToTiptap("`<img src={ticketedUrl}>`").content;

    expect(paragraph?.content?.[0]?.text).toBe("<img src={ticketedUrl}>");
  });

  it("nests a link mark inside the surrounding emphasis", () => {
    const [paragraph] = markdownToTiptap(
      "**see [the ticket](https://example.com/SUPER-2079)**",
    ).content;

    expect(paragraph?.content).toEqual([
      { type: "text", text: "see ", marks: [{ type: "bold" }] },
      {
        type: "text",
        text: "the ticket",
        marks: [
          { type: "bold" },
          { type: "link", attrs: { href: "https://example.com/SUPER-2079" } },
        ],
      },
    ]);
  });

  it("reads a blockquote as a quote around its paragraphs", () => {
    const [quote] = markdownToTiptap('> "would be good to check"').content;

    expect(quote).toEqual({
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: '"would be good to check"' }],
        },
      ],
    });
  });

  it("reads a bullet list as list items", () => {
    const [list] = markdownToTiptap("- one\n- two").content;

    expect(list?.type).toBe("bulletList");
    expect(list?.content).toHaveLength(2);
    expect(list?.content?.[0]).toEqual({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }],
    });
  });

  it("keeps an ordered list's starting number", () => {
    const [list] = markdownToTiptap("3. three\n4. four").content;

    expect(list?.type).toBe("orderedList");
    expect(list?.attrs).toEqual({ start: 3 });
  });

  it("reads a fenced block as a code block with its language", () => {
    const [block] = markdownToTiptap("```ts\nconst a = 1;\n```").content;

    expect(block).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1;" }],
    });
  });

  it("keeps a table verbatim, since no table node exists", () => {
    const [block] = markdownToTiptap("| a | b |\n| - | - |\n| 1 | 2 |").content;

    expect(block?.type).toBe("codeBlock");
    expect(block?.content?.[0]?.text).toBe("| a | b |\n| - | - |\n| 1 | 2 |");
  });

  it("breaks a single newline the way a chat message reads", () => {
    const [paragraph] = markdownToTiptap("first\nsecond").content;

    expect(paragraph?.content).toEqual([
      { type: "text", text: "first" },
      { type: "hardBreak" },
      { type: "text", text: "second" },
    ]);
  });

  it("leaves a plain mention as text the highlighter can find", () => {
    const [paragraph] = markdownToTiptap("@harshithmullapudi ptal").content;

    expect(paragraph?.content).toEqual([
      { type: "text", text: "@harshithmullapudi ptal" },
    ]);
  });

  it("never emits an empty document", () => {
    expect(markdownToTiptap("").content).toEqual([{ type: "paragraph" }]);
    expect(markdownToTiptap("   \n\n").content).toEqual([{ type: "paragraph" }]);
  });

  it("does not leave an empty text node behind", () => {
    const nodes = JSON.stringify(markdownToTiptap("**bold**\n\n\n- item"));

    expect(nodes).not.toContain('"text":""');
  });
});
