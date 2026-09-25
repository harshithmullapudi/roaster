import { describe, expect, it } from "vitest";

import {
  agentDisplay,
  agentHandle,
  agentIdentity,
  matchAgentHandle,
} from "./agent-identity";

describe("agentHandle", () => {
  it("joins the owner's name to the channel", () => {
    expect(agentHandle("fern", "core")).toBe("fern-core");
  });

  it("lowercases so @Fern-core and @fern-core are one agent", () => {
    expect(agentHandle("Fern", "core")).toBe("fern-core");
  });

  it("names channels whose owner never picked one", () => {
    expect(agentHandle(null, "core")).toBe("agent-core");
    expect(agentHandle("", "core")).toBe("agent-core");
    expect(agentHandle("   ", "core")).toBe("agent-core");
  });
});

describe("agentDisplay", () => {
  it("brackets the channel", () => {
    expect(agentDisplay("fern", "core")).toBe("fern [core]");
  });

  it("stays readable for hyphenated slugs", () => {
    expect(agentDisplay("fern", "spark-wilderness")).toBe(
      "fern [spark-wilderness]",
    );
  });
});

describe("agentIdentity", () => {
  it("carries both renderings of one agent", () => {
    expect(agentIdentity({ agentName: "fern", channelSlug: "core" })).toEqual({
      agentName: "fern",
      channelSlug: "core",
      handle: "fern-core",
      display: "fern [core]",
    });
  });
});

describe("matchAgentHandle", () => {
  const channels = [
    { agentName: "fern", slug: "core" },
    { agentName: "fern", slug: "spark-wilderness" },
    { agentName: "ash", slug: "web" },
  ];

  it("finds the agent behind a plain handle", () => {
    expect(matchAgentHandle("fern-core", channels)).toEqual(channels[0]);
  });

  it("tolerates the @ the agent probably typed", () => {
    expect(matchAgentHandle("@ash-web", channels)).toEqual(channels[2]);
  });

  it("resolves handles where both halves carry hyphens", () => {
    expect(matchAgentHandle("fern-spark-wilderness", channels)).toEqual(
      channels[1],
    );
  });

  it("returns null rather than guessing at an unknown agent", () => {
    expect(matchAgentHandle("nobody-here", channels)).toBeNull();
    expect(matchAgentHandle("fern", channels)).toBeNull();
    expect(matchAgentHandle("", channels)).toBeNull();
  });

  it("matches channels whose owner never picked a name", () => {
    expect(matchAgentHandle("agent-docs", [{ agentName: null, slug: "docs" }]))
      .toEqual({ agentName: null, slug: "docs" });
  });
});
