import type { WaitingOn } from "@roster/api";
import { describe, expect, it } from "vitest";

import { isActive, parsePublishedThread, waitingOnLabel } from "./thread-rows";

const waiting: WaitingOn = {
  handle: "sol-superset",
  display: "sol [superset]",
  channelId: "channel-2",
  channelSlug: "superset",
  threadId: "thread-2",
  status: "running",
  lastProgress: "Reading the README template…",
  task: "What is Superset, in one paragraph?",
};

const published = (thread: Record<string, unknown>) => ({
  type: "thread",
  thread: {
    id: "thread-1",
    projectId: "channel-1",
    rootMessageId: "message-1",
    status: "waiting",
    startedAt: "2026-09-18T10:16:00.000Z",
    ...thread,
  },
});

describe("isActive", () => {
  it("counts a parked thread as active — another agent is running for it", () => {
    expect(isActive("waiting")).toBe(true);
    expect(isActive("running")).toBe(true);
    expect(isActive("starting")).toBe(true);
  });

  it("does not count a thread that has stopped", () => {
    expect(isActive("completed")).toBe(false);
    expect(isActive("failed")).toBe(false);
    expect(isActive("canceled")).toBe(false);
  });
});

describe("waitingOnLabel", () => {
  it("names the agent and what it last said", () => {
    expect(waitingOnLabel(waiting)).toBe(
      "@sol-superset · Reading the README template…",
    );
  });

  it("falls back to its status, so it never reads as an idle agent", () => {
    expect(waitingOnLabel({ ...waiting, lastProgress: null })).toBe(
      "@sol-superset · Running",
    );
    expect(waitingOnLabel({ ...waiting, lastProgress: "   " })).toBe(
      "@sol-superset · Running",
    );
  });

  it("is nothing when the thread is waiting on nobody", () => {
    expect(waitingOnLabel(null)).toBeNull();
  });
});

describe("parsePublishedThread", () => {
  it("carries the agent the thread is waiting on", () => {
    const parsed = parsePublishedThread(published({ waitingOn: waiting }));
    expect(parsed?.waitingOn).toEqual(waiting);
  });

  it("keeps a missing child thread id, so the card still renders unlinked", () => {
    const parsed = parsePublishedThread(
      published({ waitingOn: { ...waiting, threadId: null } }),
    );
    expect(parsed?.waitingOn?.threadId).toBeNull();
    expect(parsed?.waitingOn?.handle).toBe("sol-superset");
  });

  it("is null when the payload carries no delegation", () => {
    expect(parsePublishedThread(published({}))?.waitingOn).toBeNull();
    expect(
      parsePublishedThread(published({ waitingOn: { handle: "sol-superset" } }))
        ?.waitingOn,
    ).toBeNull();
  });
});
