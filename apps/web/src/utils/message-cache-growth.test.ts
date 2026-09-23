import { describe, expect, it } from "vitest";

import type { MessageItem } from "~/types";
import { mergeMessage, mergeMessages } from "./message-cache";

function message(seq: number): MessageItem {
  return {
    id: `m-${seq}`,
    projectId: "p",
    seq,
    kind: "user",
    agentChannelId: null,
    agentDisplay: null,
    agentHandle: null,
    body: null,
    text: `message ${seq}`,
    clientId: null,
    parentMessageId: null,
    threadId: null,
    createdAt: new Date(1_700_000_000_000 + seq * 1000),
    editedAt: null,
    authorMemberId: null,
    authorName: "Someone",
    authorEmail: "someone@example.test",
    attachments: [],
    reactions: [],
  } as MessageItem;
}

describe("the channel message cache over a long session", () => {
  it("keeps every message a realtime feed delivers", () => {
    let list: MessageItem[] = Array.from({ length: 50 }, (_, i) => message(i));

    for (let seq = 50; seq < 3000; seq += 1) {
      list = mergeMessage(list, message(seq));
    }

    expect(list.length).toBe(3000);
  });

  it("does not shrink back to the page size when the query refetches", () => {
    let list: MessageItem[] = Array.from({ length: 2000 }, (_, i) =>
      message(i),
    );

    const newestPage = Array.from({ length: 50 }, (_, i) => message(1950 + i));
    list = mergeMessages(list, newestPage);

    expect(list.length).toBe(2000);
  });
});
