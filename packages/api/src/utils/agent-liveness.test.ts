import { describe, expect, it } from "vitest";

import { agentIsGone, type WatchSilence } from "./agent-liveness";

const NOW = 1_800_000_000_000;
const TIMEOUT_MS = 60_000;

const silence = (over: Partial<WatchSilence> = {}): WatchSilence => ({
  now: NOW,
  bound: false,
  transcriptChangedAt: NOW - 10 * TIMEOUT_MS,
  bindingChangedAt: NOW - 10 * TIMEOUT_MS,
  timeoutMs: TIMEOUT_MS,
  ...over,
});

describe("agentIsGone", () => {
  it("waits on a bound agent however long its tool call runs", () => {
    expect(agentIsGone(silence({ bound: true }))).toBe(false);
  });

  it("gives up once nothing is bound and everything has gone quiet", () => {
    expect(agentIsGone(silence())).toBe(true);
  });

  it("waits out the timeout after the agent unbinds", () => {
    expect(agentIsGone(silence({ bindingChangedAt: NOW - 1_000 }))).toBe(false);
  });

  it("waits while output is still arriving", () => {
    expect(agentIsGone(silence({ transcriptChangedAt: NOW - 1_000 }))).toBe(
      false,
    );
  });

  it("gives up the moment the timeout is reached, not a poll later", () => {
    expect(
      agentIsGone(
        silence({
          transcriptChangedAt: NOW - TIMEOUT_MS,
          bindingChangedAt: NOW - TIMEOUT_MS,
        }),
      ),
    ).toBe(true);
  });
});
