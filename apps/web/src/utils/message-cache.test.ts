import { describe, expect, it } from "vitest";

import type { MessageItem } from "~/types";

import {
  applyReaction,
  groupReactions,
  type MessageReaction,
  parsePublishedDeletion,
  parsePublishedReaction,
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
  reactions: [],
});

const reaction = (patch: Partial<MessageReaction> = {}): MessageReaction => ({
  messageId: "a",
  projectId: "channel-1",
  threadId: null,
  emoji: "✅",
  memberId: "member-1",
  added: true,
  ...patch,
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

describe("parsePublishedReaction", () => {
  it("reads a reaction envelope", () => {
    expect(
      parsePublishedReaction({
        type: "reaction",
        messageId: "m1",
        projectId: "channel-1",
        threadId: "t1",
        emoji: "✅",
        memberId: "member-2",
        added: true,
      }),
    ).toEqual({
      messageId: "m1",
      projectId: "channel-1",
      threadId: "t1",
      emoji: "✅",
      memberId: "member-2",
      added: true,
    });
  });

  it("accepts a reaction on a message outside any thread", () => {
    expect(
      parsePublishedReaction({
        type: "reaction",
        messageId: "m1",
        projectId: "channel-1",
        threadId: null,
        emoji: "👀",
        memberId: "member-2",
        added: false,
      })?.threadId,
    ).toBeNull();
  });

  it("ignores the other envelopes on the same channel", () => {
    expect(parsePublishedReaction({ type: "message", message: {} })).toBeNull();
    expect(
      parsePublishedReaction({ type: "message-deleted", messageId: "m1" }),
    ).toBeNull();
  });

  it("ignores a reaction missing its fields", () => {
    expect(
      parsePublishedReaction({
        type: "reaction",
        messageId: "m1",
        projectId: "channel-1",
        emoji: "✅",
        added: true,
      }),
    ).toBeNull();
    expect(parsePublishedReaction(null)).toBeNull();
    expect(parsePublishedReaction("reaction")).toBeNull();
  });

  it("ignores a reaction whose added flag is not a boolean", () => {
    expect(
      parsePublishedReaction({
        type: "reaction",
        messageId: "m1",
        projectId: "channel-1",
        threadId: null,
        emoji: "✅",
        memberId: "member-2",
        added: "true",
      }),
    ).toBeNull();
  });
});

describe("groupReactions", () => {
  it("counts one pill per emoji and marks the viewer's own", () => {
    expect(
      groupReactions(
        [
          { emoji: "✅", memberId: "member-1" },
          { emoji: "✅", memberId: "member-2" },
          { emoji: "👀", memberId: "member-2" },
        ],
        "member-1",
      ),
    ).toEqual([
      { emoji: "✅", count: 2, mine: true },
      { emoji: "👀", count: 1, mine: false },
    ]);
  });

  it("orders lexically, so the pills sit the same way on every client", () => {
    const one = groupReactions(
      [
        { emoji: "👀", memberId: "member-2" },
        { emoji: "✅", memberId: "member-1" },
        { emoji: "✅", memberId: "member-3" },
      ],
      "member-1",
    );
    const other = groupReactions(
      [
        { emoji: "✅", memberId: "member-3" },
        { emoji: "✅", memberId: "member-1" },
        { emoji: "👀", memberId: "member-2" },
      ],
      "member-1",
    );

    expect(one.map((group) => group.emoji)).toEqual(
      other.map((group) => group.emoji),
    );
    expect(one).toEqual(other);
  });

  it("counts a repeated pair once", () => {
    expect(
      groupReactions(
        [
          { emoji: "✅", memberId: "member-1" },
          { emoji: "✅", memberId: "member-1" },
        ],
        "member-1",
      ),
    ).toEqual([{ emoji: "✅", count: 1, mine: true }]);
  });

  it("reads a message with no reactions", () => {
    expect(groupReactions([], "member-1")).toEqual([]);
    expect(groupReactions(undefined, "member-1")).toEqual([]);
  });
});

describe("applyReaction", () => {
  it("appends the pair to the matching message", () => {
    const list = [message("a", 1), message("b", 2)];
    const next = applyReaction(list, reaction());

    expect(next[0]?.reactions).toEqual([
      { emoji: "✅", memberId: "member-1" },
    ]);
    expect(next[1]).toBe(list[1]);
  });

  it("does not append the same pair twice", () => {
    const list = applyReaction([message("a", 1)], reaction());
    expect(applyReaction(list, reaction())).toBe(list);
  });

  it("removes the pair when the reaction was taken back", () => {
    const list = applyReaction([message("a", 1)], reaction());
    const next = applyReaction(list, reaction({ added: false }));

    expect(next[0]?.reactions).toEqual([]);
  });

  it("leaves the list alone when removing a pair that is not there", () => {
    const list = [message("a", 1)];
    expect(applyReaction(list, reaction({ added: false }))).toBe(list);
  });

  it("keeps the other reactors on the same emoji", () => {
    const list = applyReaction(
      applyReaction([message("a", 1)], reaction()),
      reaction({ memberId: "member-2" }),
    );
    const next = applyReaction(list, reaction({ added: false }));

    expect(next[0]?.reactions).toEqual([
      { emoji: "✅", memberId: "member-2" },
    ]);
  });

  it("drops the event when the message is not in the cache", () => {
    const list = [message("a", 1)];
    expect(applyReaction(list, reaction({ messageId: "gone" }))).toBe(list);
  });
});
