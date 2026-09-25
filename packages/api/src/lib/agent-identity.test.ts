import { describe, expect, it } from "vitest";

import {
  agentDisplay,
  channelAgentHandle,
  normalizeHandle,
} from "./agent-identity";

describe("normalizeHandle", () => {
  it("drops the @ the agent probably typed", () => {
    expect(normalizeHandle("@fern-core")).toBe("fern-core");
  });

  it("lowercases so @Fern-core and @fern-core are one agent", () => {
    expect(normalizeHandle("Fern-Core")).toBe("fern-core");
  });

  it("treats absence and whitespace alike", () => {
    expect(normalizeHandle(null)).toBe("");
    expect(normalizeHandle("   ")).toBe("");
  });
});

describe("agentDisplay", () => {
  it("shows the handle people type to reach it", () => {
    expect(agentDisplay("superset-pm")).toBe("superset-pm");
  });

  it("names an agent that somehow has none", () => {
    expect(agentDisplay(null)).toBe("agent");
  });
});

describe("channelAgentHandle", () => {
  it("is the channel's own slug", () => {
    expect(channelAgentHandle("core")).toBe("core");
    expect(channelAgentHandle("spark-wilderness")).toBe("spark-wilderness");
  });

  it("names a channel with no slug to take", () => {
    expect(channelAgentHandle("")).toBe("agent");
    expect(channelAgentHandle("   ")).toBe("agent");
  });
});
