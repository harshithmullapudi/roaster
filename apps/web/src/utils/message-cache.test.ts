import { describe, expect, it } from "vitest";

import type { MessageItem } from "~/types";

import {
  parsePublishedDeletion,
  removeMessage,
} from "./message-cache";

const message = (id: string, seq: number): MessageItem => ({
  id,
  projectId: "channel-1",
  seq,
  kind: "user",
  agentChannelId: null,
  agentDisplay: null,
  agentHandle: null,
  body: null,
  text: `message ${id}`,
  clientId: null,
  parentMessageId: null,
  threadId: null,
  createdAt: new Date("2026-09-18T09:00:00Z"),
  editedAt: null,
  authorMemberId: "member-1",
  authorName: "Harshith",
  authorEmail: "harshith@tegon.ai",
  attachments: [],
});

describe("removeMessage", () => {
  it("drops the message with that id", () => {
    const list = [message("a", 1), message("b", 2), message("c", 3)];
    expect(removeMessage(list, "b").map((m) => m.id)).toEqual(["a", "c"]);
  });

  it("returns the same array when nothing matched, so React skips the render", () => {
    const list = [message("a", 1)];
    expect(removeMessage(list, "b")).toBe(list);
  });
});

describe("parsePublishedDeletion", () => {
  it("reads a deletion envelope", () => {
    expect(
      parsePublishedDeletion({
        type: "message-deleted",
        messageId: "m1",
        projectId: "channel-1",
        threadId: "t1",
      }),
    ).toEqual({ messageId: "m1", projectId: "channel-1", threadId: "t1" });
  });

  it("accepts a deletion with no thread", () => {
    expect(
      parsePublishedDeletion({
        type: "message-deleted",
        messageId: "m1",
        projectId: "channel-1",
        threadId: null,
      }),
    ).toEqual({ messageId: "m1", projectId: "channel-1", threadId: null });
  });

  it("ignores the other envelopes on the same channel", () => {
    expect(parsePublishedDeletion({ type: "message", message: {} })).toBeNull();
    expect(parsePublishedDeletion({ type: "thread", thread: {} })).toBeNull();
  });

  it("ignores a deletion missing its ids", () => {
    expect(
      parsePublishedDeletion({ type: "message-deleted", projectId: "c1" }),
    ).toBeNull();
    expect(parsePublishedDeletion(null)).toBeNull();
  });
});
