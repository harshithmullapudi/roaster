import { describe, expect, it } from "vitest";

import { mentionedHandles } from "./message-mentions";

const KNOWN = ["sol-superset", "fern-core", "fern-core-web"];

const chip = (label: string, id = "11111111-1111-1111-1111-111111111111") => ({
  type: "mention",
  attrs: { id, label },
});

const doc = (...content: unknown[]) => ({
  type: "doc",
  content: [{ type: "paragraph", content }],
});

const text = (value: string) => ({ type: "text", text: value });

const handles = (body: unknown, plain = "") =>
  mentionedHandles({ body, text: plain, known: KNOWN });

describe("mentionedHandles", () => {
  it("finds a mention chip picked from the autocomplete", () => {
    expect(handles(doc(chip("sol-superset")))).toEqual(["sol-superset"]);
  });

  it("finds a chip nested inside a list item", () => {
    const body = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [chip("sol-superset")] },
              ],
            },
          ],
        },
      ],
    };
    expect(handles(body)).toEqual(["sol-superset"]);
  });

  it("strips a leading @ the label may carry", () => {
    expect(handles(doc(chip("@sol-superset")))).toEqual(["sol-superset"]);
  });

  it("trusts a chip whose handle is no longer known", () => {
    // The typist picked it from the list; a since-renamed agent is still a
    // deliberate summons, not a typo.
    expect(handles(doc(chip("ghost-channel")))).toEqual(["ghost-channel"]);
  });

  it("falls back to the id when a chip carries no label", () => {
    expect(handles(doc({ type: "mention", attrs: { id: "sol-superset" } }))).toEqual(
      ["sol-superset"],
    );
  });

  it("finds a known handle typed out as plain text", () => {
    expect(handles(doc(text("@fern-core ping")), "@fern-core ping")).toEqual([
      "fern-core",
    ]);
  });

  it("prefers the longest handle so @fern-core-web is not truncated", () => {
    expect(handles(doc(text("@fern-core-web")), "@fern-core-web")).toEqual([
      "fern-core-web",
    ]);
  });

  it("ignores a plain-text @word that names no agent", () => {
    expect(handles(doc(text("@nobody here")), "@nobody here")).toEqual([]);
  });

  it("ignores the @ inside an email address", () => {
    const line = "mail sol-superset@fern-core.example";
    expect(handles(doc(text(line)), line)).toEqual([]);
  });

  it("dedupes an agent named as both a chip and plain text", () => {
    expect(
      handles(doc(chip("sol-superset"), text(" @sol-superset")), " @sol-superset"),
    ).toEqual(["sol-superset"]);
  });

  it("matches a handle case-insensitively", () => {
    expect(handles(doc(text("@Fern-Core")), "@Fern-Core")).toEqual(["fern-core"]);
  });

  it("returns nothing for a message that mentions no one", () => {
    const line = "can I run the host in a container?";
    expect(handles(doc(text(line)), line)).toEqual([]);
  });

  it("survives a body that is not a Tiptap document", () => {
    expect(handles(null)).toEqual([]);
    expect(handles("just a string")).toEqual([]);
    expect(handles({ type: "doc" })).toEqual([]);
    expect(handles({ type: "doc", content: "not an array" })).toEqual([]);
  });

  it("ignores a chip with no usable identity", () => {
    expect(handles(doc({ type: "mention", attrs: {} }))).toEqual([]);
    expect(handles(doc({ type: "mention" }))).toEqual([]);
  });

  it("finds nothing in plain text when no agents are known", () => {
    expect(
      mentionedHandles({ body: null, text: "@fern-core", known: [] }),
    ).toEqual([]);
  });
});
