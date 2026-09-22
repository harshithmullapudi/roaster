import type { WaitingOn } from "@roster/api";
import { describe, expect, it } from "vitest";

import {
  isActive,
  parsePublishedThread,
  statusLabel,
  statusTone,
  waitingOnLabel,
} from "./thread-rows";

const STATUSES = [
  "starting",
  "running",
  "needs_input",
  "waiting",
  "idle",
  "completed",
  "failed",
  "canceled",
];

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

  it("counts a thread that is asking someone a question", () => {
    expect(isActive("needs_input")).toBe(true);
  });

  it("does not count an idle thread — it would sit in the sidebar forever", () => {
    expect(isActive("idle")).toBe(false);
  });

  it("settles a completed thread whatever its session was doing", () => {
    const completedAt = new Date("2026-09-18T11:00:00.000Z");
    for (const status of STATUSES) {
      expect(isActive(status, completedAt)).toBe(false);
    }
  });

  it("leaves a thread that was never completed to its session", () => {
    expect(isActive("running", null)).toBe(true);
    expect(isActive("waiting", undefined)).toBe(true);
    expect(isActive("failed", null)).toBe(false);
  });
});

describe("statusLabel", () => {
  it("reads as completed off the completion flag alone", () => {
    const completedAt = new Date("2026-09-18T11:00:00.000Z");
    for (const status of STATUSES) {
      expect(statusLabel(status, completedAt)).toBe("Completed");
    }
  });

  it("still names the session status when nobody completed the thread", () => {
    expect(statusLabel("running")).toBe("Running");
    expect(statusLabel("waiting", null)).toBe("Waiting");
    expect(statusLabel("completed")).toBe("Completed");
    expect(statusLabel("canceled", null)).toBe("Canceled");
  });

  it("names the two states a stopped session can be in", () => {
    expect(statusLabel("needs_input")).toBe("Needs input");
    expect(statusLabel("idle")).toBe("Idle");
  });
});

describe("statusTone", () => {
  it("gives every status the thread list can show a dot colour", () => {
    for (const status of STATUSES) {
      expect(statusTone(status)).not.toBeNull();
    }
  });

  it("tells running, needs_input and idle apart", () => {
    const tones = new Set([
      statusTone("running"),
      statusTone("needs_input"),
      statusTone("idle"),
    ]);
    expect(tones.size).toBe(3);
  });

  it("has no colour for a status it does not know", () => {
    expect(statusTone("banana")).toBeNull();
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

  it("carries the completion across the wire, so other viewers see it", () => {
    const parsed = parsePublishedThread(
      published({
        completedAt: "2026-09-18T11:00:00.000Z",
        completedByMemberId: "member-1",
      }),
    );
    expect(parsed?.completedAt).toEqual(new Date("2026-09-18T11:00:00.000Z"));
    expect(parsed?.completedByMemberId).toBe("member-1");
    expect(isActive(parsed?.status ?? "", parsed?.completedAt)).toBe(false);
  });

  it("leaves an open thread uncompleted", () => {
    const parsed = parsePublishedThread(published({}));
    expect(parsed?.completedAt).toBeNull();
    expect(parsed?.completedByMemberId).toBeNull();
  });

  it("refuses a completion it cannot read", () => {
    const parsed = parsePublishedThread(
      published({ completedAt: "not a date", completedByMemberId: 7 }),
    );
    expect(parsed?.completedAt).toBeNull();
    expect(parsed?.completedByMemberId).toBeNull();
    expect(
      parsePublishedThread(published({ completedAt: {} }))?.completedAt,
    ).toBeNull();
  });
});
