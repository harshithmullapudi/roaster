import { describe, expect, it } from "vitest";

import { mentionedHandles } from "./message-mentions";

const AGENTS = ["sol-superset", "fern-core", "fern-core-web", "harshith-roster"];
const MEMBERS = ["harshith", "sol"];

const chip = (
  label: string,
  kind?: "agent" | "member",
  id = "11111111-1111-1111-1111-111111111111",
) => ({
  type: "mention",
  attrs: kind ? { id, label, kind } : { id, label },
});

const doc = (...content: unknown[]) => ({
  type: "doc",
  content: [{ type: "paragraph", content }],
});

const text = (value: string) => ({ type: "text", text: value });

const handles = (body: unknown, plain = "") =>
  mentionedHandles({ body, text: plain, agents: AGENTS, members: MEMBERS });

const agents = (body: unknown, plain = "") => handles(body, plain).agents;

describe("mentionedHandles", () => {
  it("finds a mention chip picked from the autocomplete", () => {
    expect(agents(doc(chip("sol-superset")))).toEqual(["sol-superset"]);
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
    expect(agents(body)).toEqual(["sol-superset"]);
  });

  it("strips a leading @ the label may carry", () => {
    expect(agents(doc(chip("@sol-superset")))).toEqual(["sol-superset"]);
  });

  it("trusts a chip whose handle is no longer known", () => {
    // The typist picked it from the list; a since-renamed agent is still a
    // deliberate summons, not a typo.
    expect(agents(doc(chip("ghost-channel")))).toEqual(["ghost-channel"]);
  });

  it("falls back to the id when a chip carries no label", () => {
    expect(agents(doc({ type: "mention", attrs: { id: "sol-superset" } }))).toEqual(
      ["sol-superset"],
    );
  });

  it("finds a known handle typed out as plain text", () => {
    expect(agents(doc(text("@fern-core ping")), "@fern-core ping")).toEqual([
      "fern-core",
    ]);
  });

  it("prefers the longest handle so @fern-core-web is not truncated", () => {
    expect(agents(doc(text("@fern-core-web")), "@fern-core-web")).toEqual([
      "fern-core-web",
    ]);
  });

  it("ignores a plain-text @word that names no agent", () => {
    expect(handles(doc(text("@nobody here")), "@nobody here")).toEqual({
      agents: [],
      members: [],
    });
  });

  it("ignores the @ inside an email address", () => {
    const line = "mail sol-superset@fern-core.example";
    expect(agents(doc(text(line)), line)).toEqual([]);
  });

  it("dedupes an agent named as both a chip and plain text", () => {
    expect(
      agents(doc(chip("sol-superset"), text(" @sol-superset")), " @sol-superset"),
    ).toEqual(["sol-superset"]);
  });

  it("matches a handle case-insensitively", () => {
    expect(agents(doc(text("@Fern-Core")), "@Fern-Core")).toEqual(["fern-core"]);
  });

  it("returns nothing for a message that mentions no one", () => {
    const line = "can I run the host in a container?";
    expect(handles(doc(text(line)), line)).toEqual({ agents: [], members: [] });
  });

  it("survives a body that is not a Tiptap document", () => {
    expect(agents(null)).toEqual([]);
    expect(agents("just a string")).toEqual([]);
    expect(agents({ type: "doc" })).toEqual([]);
    expect(agents({ type: "doc", content: "not an array" })).toEqual([]);
  });

  it("ignores a chip with no usable identity", () => {
    expect(agents(doc({ type: "mention", attrs: {} }))).toEqual([]);
    expect(agents(doc({ type: "mention" }))).toEqual([]);
  });

  it("finds nothing in plain text when nobody is known", () => {
    expect(
      mentionedHandles({ body: null, text: "@fern-core", agents: [] }),
    ).toEqual({ agents: [], members: [] });
  });

  it("does not count a person as an agent, so a paused channel stays asleep", () => {
    // The whole point of the split: "@harshith" is a note to a human and must
    // not wake the channel's agent.
    expect(handles(doc(chip("harshith", "member")), "")).toEqual({
      agents: [],
      members: ["harshith"],
    });
  });

  it("reads a kind-less chip as an agent, as every chip written before was", () => {
    expect(handles(doc(chip("sol-superset")))).toEqual({
      agents: ["sol-superset"],
      members: [],
    });
  });

  it("reads a plain-text person as a member, not an agent", () => {
    const line = "@harshith can you look?";
    expect(handles(doc(text(line)), line)).toEqual({
      agents: [],
      members: ["harshith"],
    });
  });

  it("still prefers @harshith-roster over the person @harshith", () => {
    const line = "@harshith-roster please run it";
    expect(handles(doc(text(line)), line)).toEqual({
      agents: ["harshith-roster"],
      members: [],
    });
  });

  it("gives an exact tie to the agent", () => {
    // Nothing stops a person's handle from also being an agent handle; the
    // agent reading held before people could be mentioned, so it holds now.
    expect(
      mentionedHandles({
        body: null,
        text: "@sol",
        agents: ["sol"],
        members: ["sol"],
      }),
    ).toEqual({ agents: ["sol"], members: [] });
  });

  it("finds an agent and a person named in the same message", () => {
    const line = "@fern-core ship it, @harshith review";
    expect(handles(doc(text(line)), line)).toEqual({
      agents: ["fern-core"],
      members: ["harshith"],
    });
  });
});
