import { describe, expect, it } from "vitest";

import { parseArgs } from "./args.js";
import { formatChannel, formatThread, readTarget } from "./read.js";

describe("readTarget", () => {
  it("reads a channel when --channel-id is given", () => {
    const target = readTarget(parseArgs(["read", "messages", "--channel-id", "c1"]));
    expect(target).toEqual({ ok: true, kind: "channel", id: "c1" });
  });

  it("reads a thread when --thread-id is given", () => {
    const target = readTarget(parseArgs(["read", "messages", "--thread-id", "t1"]));
    expect(target).toEqual({ ok: true, kind: "thread", id: "t1" });
  });

  it("names both flags when neither is given", () => {
    const target = readTarget(parseArgs(["read", "messages"]));
    expect(target.ok).toBe(false);
    expect(target.ok === false && target.message).toContain("--channel-id");
    expect(target.ok === false && target.message).toContain("--thread-id");
  });

  it("refuses both flags at once rather than picking one", () => {
    const target = readTarget(
      parseArgs(["read", "messages", "--channel-id", "c1", "--thread-id", "t1"]),
    );
    expect(target.ok).toBe(false);
  });

  it("treats a valueless flag as not given", () => {
    const target = readTarget(parseArgs(["read", "messages", "--thread-id"]));
    expect(target.ok).toBe(false);
  });
});

const CHANNEL = { slug: "roster" };

describe("formatChannel", () => {
  it("heads the page with the channel and lists messages in order", () => {
    const out = formatChannel({
      channel: CHANNEL,
      messages: [
        {
          author: "Harshith",
          text: "shipping today",
          createdAt: "2026-09-20T10:02:11Z",
          thread: null,
        },
        {
          author: "Priya",
          text: "nice",
          createdAt: "2026-09-20T10:31:02Z",
          thread: null,
        },
      ],
    });

    expect(out).toBe(
      [
        "# roster",
        "",
        "[2026-09-20T10:02:11Z] Harshith:",
        "shipping today",
        "",
        "[2026-09-20T10:31:02Z] Priya:",
        "nice",
      ].join("\n"),
    );
  });

  it("marks a message that has a thread with the id to read next", () => {
    const out = formatChannel({
      channel: CHANNEL,
      messages: [
        {
          author: "Harshith",
          text: "does the cli read threads?",
          createdAt: "2026-09-20T10:02:11Z",
          thread: { id: "8f2a1c4e", replyCount: 4 },
        },
      ],
    });

    expect(out).toContain("  ↳ thread 8f2a1c4e · 4 replies");
  });

  it("counts a single reply in the singular", () => {
    const out = formatChannel({
      channel: CHANNEL,
      messages: [
        {
          author: "Harshith",
          text: "hi",
          createdAt: "2026-09-20T10:02:11Z",
          thread: { id: "t1", replyCount: 1 },
        },
      ],
    });

    expect(out).toContain("  ↳ thread t1 · 1 reply");
  });

  it("says a started thread is still unanswered rather than showing a zero", () => {
    const out = formatChannel({
      channel: CHANNEL,
      messages: [
        {
          author: "Harshith",
          text: "hi",
          createdAt: "2026-09-20T10:02:11Z",
          thread: { id: "t1", replyCount: 0 },
        },
      ],
    });

    expect(out).toContain("  ↳ thread t1 · no replies yet");
  });

  it("says so when a channel has nothing in it", () => {
    expect(formatChannel({ channel: CHANNEL, messages: [] })).toBe(
      "# roster\n\nNo messages yet.",
    );
  });
});

describe("formatThread", () => {
  const THREAD = { id: "8f2a1c4e", status: "running", replyCount: 2 };

  it("heads the page with the channel, thread status and reply count", () => {
    const out = formatThread({
      channel: CHANNEL,
      thread: THREAD,
      messages: [],
    });

    expect(out.split("\n")[0]).toBe("# roster · thread 8f2a1c4e · running · 2 replies");
  });

  it("lists the root and its replies oldest first", () => {
    const out = formatThread({
      channel: CHANNEL,
      thread: THREAD,
      messages: [
        {
          author: "Harshith",
          text: "does the cli read threads?",
          createdAt: "2026-09-20T10:02:11Z",
        },
        {
          author: "harshith-roster",
          text: "not yet",
          createdAt: "2026-09-20T10:04:55Z",
        },
      ],
    });

    expect(out).toBe(
      [
        "# roster · thread 8f2a1c4e · running · 2 replies",
        "",
        "[2026-09-20T10:02:11Z] Harshith:",
        "does the cli read threads?",
        "",
        "[2026-09-20T10:04:55Z] harshith-roster:",
        "not yet",
      ].join("\n"),
    );
  });

  it("never marks threads inside a thread", () => {
    const out = formatThread({
      channel: CHANNEL,
      thread: THREAD,
      messages: [
        {
          author: "Harshith",
          text: "hi",
          createdAt: "2026-09-20T10:02:11Z",
          thread: { id: "t1", replyCount: 3 },
        },
      ],
    });

    expect(out).not.toContain("↳");
  });
});
