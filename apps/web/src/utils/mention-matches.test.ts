import { describe, expect, it } from "vitest";

import { findMentions } from "./mention-matches";
import type { MentionItem } from "./mentions";

function agent(handle: string): MentionItem {
  return {
    id: handle,
    kind: "agent",
    slug: handle,
    name: handle,
    visibility: "public",
    handle,
    display: handle,
  };
}

function person(handle: string): MentionItem {
  return { ...agent(handle), kind: "member", display: handle };
}

const agents = [agent("sol-superset"), agent("sol-core"), agent("ash-web")];

describe("findMentions", () => {
  it("finds a handle in ordinary prose", () => {
    const text = "hand this to @sol-superset please";
    expect(findMentions(text, agents)).toEqual([
      { from: 13, to: 26, handle: "sol-superset", kind: "agent" },
    ]);
  });

  it("finds several in one message", () => {
    const found = findMentions("@sol-core and @ash-web", agents);
    expect(found.map((m) => m.handle)).toEqual(["sol-core", "ash-web"]);
  });

  it("leaves unknown handles as plain text", () => {
    expect(findMentions("@nobody-here hello", agents)).toEqual([]);
  });

  it("prefers the longest matching handle", () => {
    const withLonger = [...agents, agent("sol-core-docs")];
    const found = findMentions("ping @sol-core-docs now", withLonger);
    expect(found).toEqual([
      { from: 5, to: 19, handle: "sol-core-docs", kind: "agent" },
    ]);
  });

  it("does not treat an email's @ as a mention", () => {
    expect(findMentions("born4rhell@sol-core.com", agents)).toEqual([]);
  });

  it("matches case-insensitively", () => {
    expect(findMentions("@SOL-CORE", agents)).toEqual([
      { from: 0, to: 9, handle: "sol-core", kind: "agent" },
    ]);
  });

  it("finds a handle at the very start and very end", () => {
    expect(findMentions("@ash-web", agents)).toHaveLength(1);
    expect(findMentions("ask @ash-web", agents)).toHaveLength(1);
  });

  it("returns nothing when no agents are loaded yet", () => {
    expect(findMentions("@sol-core", [])).toEqual([]);
  });

  it("handles punctuation right after the handle", () => {
    const found = findMentions("ask @sol-core, then wait", agents);
    expect(found).toEqual([
      { from: 4, to: 13, handle: "sol-core", kind: "agent" },
    ]);
  });

  it("finds a person and reports the kind the pill styles by", () => {
    const found = findMentions("@sol take a look", [...agents, person("sol")]);
    expect(found).toEqual([{ from: 0, to: 4, handle: "sol", kind: "member" }]);
  });

  it("prefers the agent @sol-core over the person @sol", () => {
    const found = findMentions("@sol-core ship it", [...agents, person("sol")]);
    expect(found).toEqual([
      { from: 0, to: 9, handle: "sol-core", kind: "agent" },
    ]);
  });

  it("gives an exact tie to the agent", () => {
    const found = findMentions("@ash-web", [...agents, person("ash-web")]);
    expect(found).toEqual([
      { from: 0, to: 8, handle: "ash-web", kind: "agent" },
    ]);
  });
});
