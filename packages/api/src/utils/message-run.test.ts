import { describe, expect, it } from "vitest";

import {
  contiguousRun,
  RUN_WINDOW_MS,
  type RunMessage,
  sessionPrompt,
} from "./message-run";

const BASE = new Date("2026-01-01T12:00:00.000Z").getTime();

function message(
  id: string,
  over: Partial<RunMessage> & { agoMs?: number } = {},
): RunMessage {
  const { agoMs = 0, ...rest } = over;
  return {
    id,
    authorMemberId: "user1",
    createdAt: new Date(BASE - agoMs),
    threadId: null,
    text: id,
    ...rest,
  };
}

describe("contiguousRun", () => {
  it("returns just the newest message when nothing precedes it", () => {
    const newest = message("D");
    expect(contiguousRun({ newest, earlier: [] }).map((m) => m.id)).toEqual([
      "D",
    ]);
  });

  it("keeps a two message run in oldest to newest order", () => {
    const newest = message("D");
    const earlier = [message("C", { agoMs: 30_000 })];
    expect(contiguousRun({ newest, earlier }).map((m) => m.id)).toEqual([
      "C",
      "D",
    ]);
  });

  it("stops at a message from a different author", () => {
    const newest = message("D");
    const earlier = [
      message("C", { agoMs: 30_000 }),
      message("B", { agoMs: 60_000, authorMemberId: "user2" }),
      message("A", { agoMs: 90_000 }),
    ];
    expect(contiguousRun({ newest, earlier }).map((m) => m.id)).toEqual([
      "C",
      "D",
    ]);
  });

  it("stops at the run window cutoff", () => {
    const newest = message("D");
    const earlier = [
      message("C", { agoMs: 60_000 }),
      message("B", { agoMs: RUN_WINDOW_MS + 1 }),
      message("A", { agoMs: RUN_WINDOW_MS + 2 }),
    ];
    expect(contiguousRun({ newest, earlier }).map((m) => m.id)).toEqual([
      "C",
      "D",
    ]);
  });

  it("stops at a message the agent already answered", () => {
    const newest = message("D");
    const earlier = [
      message("C", { agoMs: 30_000, threadId: "thread-c" }),
      message("B", { agoMs: 60_000 }),
    ];
    expect(contiguousRun({ newest, earlier }).map((m) => m.id)).toEqual(["D"]);
  });

  it("honours an explicit window", () => {
    const newest = message("D");
    const earlier = [message("C", { agoMs: 20_000 })];
    expect(
      contiguousRun({ newest, earlier, windowMs: 10_000 }).map((m) => m.id),
    ).toEqual(["D"]);
  });
});

describe("sessionPrompt", () => {
  it("passes a lone request through untouched", () => {
    expect(sessionPrompt({ context: [], request: "Do the thing" })).toBe(
      "Do the thing",
    );
  });

  it("keeps the request separate from earlier lines", () => {
    expect(
      sessionPrompt({ context: ["Said C", " "], request: "Do D" }),
    ).toBe("Earlier in the channel:\n- Said C\n\nRequest:\nDo D");
  });
});
