import { describe, expect, it } from "vitest";

import {
  type NotificationEvent,
  notifiableMembers,
  notificationTypeFor,
  planNotifications,
  PREVIEW_LENGTH,
  previewOf,
  type ThreadSubscriber,
} from "./notification-type";

const AUTHOR = "11111111-1111-1111-1111-111111111111";
const REPLIER = "22222222-2222-2222-2222-222222222222";
const BYSTANDER = "33333333-3333-3333-3333-333333333333";

const agentReply: NotificationEvent = {
  kind: "agent",
  parentMessageId: "44444444-4444-4444-4444-444444444444",
  causedByMemberId: null,
  mentionedMemberIds: [],
  leadStatus: "completed",
};

const event = (over: Partial<NotificationEvent> = {}): NotificationEvent => ({
  ...agentReply,
  ...over,
});

const following = (memberId: string): ThreadSubscriber => ({
  memberId,
  mutedAt: null,
});

describe("notificationTypeFor", () => {
  it("calls a finished agent turn a reply", () => {
    expect(notificationTypeFor(agentReply, AUTHOR)).toBe("agent_replied");
  });

  it("lets an explicit outcome override a parked thread's status", () => {
    const settled = event({ leadStatus: "waiting", outcome: "agent_replied" });
    expect(notificationTypeFor(settled, AUTHOR)).toBe("agent_replied");
  });

  it("still lets a mention outrank an explicit outcome", () => {
    const settled = event({
      leadStatus: "waiting",
      outcome: "agent_replied",
      mentionedMemberIds: [AUTHOR],
    });
    expect(notificationTypeFor(settled, AUTHOR)).toBe("mentioned");
  });

  it("ignores an outcome on a message a person wrote", () => {
    const human = event({
      kind: "user",
      causedByMemberId: REPLIER,
      outcome: "agent_replied",
    });
    expect(notificationTypeFor(human, AUTHOR)).toBe("human_replied");
  });

  it("calls a parked agent turn a wait", () => {
    expect(notificationTypeFor(event({ leadStatus: "waiting" }), AUTHOR)).toBe(
      "agent_waiting",
    );
  });

  it("calls an agent turn that stopped to ask a question a request for input", () => {
    expect(
      notificationTypeFor(event({ leadStatus: "needs_input" }), AUTHOR),
    ).toBe("agent_needs_input");
  });

  it("calls a broken agent turn a failure", () => {
    expect(notificationTypeFor(event({ leadStatus: "failed" }), AUTHOR)).toBe(
      "agent_failed",
    );
  });

  it("falls back to a reply when the session status is unknown", () => {
    expect(notificationTypeFor(event({ leadStatus: null }), AUTHOR)).toBe(
      "agent_replied",
    );
    expect(notificationTypeFor(event({ leadStatus: "running" }), AUTHOR)).toBe(
      "agent_replied",
    );
  });

  it("calls a person's reply a human reply", () => {
    const human = event({ kind: "user", causedByMemberId: REPLIER });
    expect(notificationTypeFor(human, AUTHOR)).toBe("human_replied");
  });

  it("says nothing about a person's first message in a channel", () => {
    const opener = event({
      kind: "user",
      parentMessageId: null,
      causedByMemberId: AUTHOR,
    });
    expect(notificationTypeFor(opener, BYSTANDER)).toBeNull();
  });

  it("says nothing about a delegation record", () => {
    expect(notificationTypeFor(event({ kind: "delegation" }), AUTHOR)).toBeNull();
  });

  it("lets a mention outrank an agent reply", () => {
    const mentioning = event({ mentionedMemberIds: [BYSTANDER] });
    expect(notificationTypeFor(mentioning, BYSTANDER)).toBe("mentioned");
    expect(notificationTypeFor(mentioning, AUTHOR)).toBe("agent_replied");
  });

  it("lets a mention outrank a human reply", () => {
    const mentioning = event({
      kind: "user",
      causedByMemberId: REPLIER,
      mentionedMemberIds: [BYSTANDER],
    });
    expect(notificationTypeFor(mentioning, BYSTANDER)).toBe("mentioned");
  });

  it("lets a mention outrank a failure", () => {
    const mentioning = event({
      leadStatus: "failed",
      mentionedMemberIds: [BYSTANDER],
    });
    expect(notificationTypeFor(mentioning, BYSTANDER)).toBe("mentioned");
  });
});

describe("notifiableMembers", () => {
  it("skips whoever caused the event", () => {
    expect(
      notifiableMembers([following(AUTHOR), following(REPLIER)], REPLIER),
    ).toEqual([AUTHOR]);
  });

  it("keeps everyone when nobody caused it", () => {
    expect(
      notifiableMembers([following(AUTHOR), following(REPLIER)], null),
    ).toEqual([AUTHOR, REPLIER]);
  });

  it("skips a muted subscription", () => {
    const muted: ThreadSubscriber = { memberId: REPLIER, mutedAt: new Date() };
    expect(notifiableMembers([following(AUTHOR), muted], null)).toEqual([
      AUTHOR,
    ]);
  });
});

describe("planNotifications", () => {
  it("notifies the thread author about their agent, since nobody caused it", () => {
    expect(
      planNotifications({
        event: agentReply,
        subscribers: [following(AUTHOR)],
      }),
    ).toEqual([{ memberId: AUTHOR, type: "agent_replied" }]);
  });

  it("never pings the person who wrote the message", () => {
    const planned = planNotifications({
      event: event({ kind: "user", causedByMemberId: REPLIER }),
      subscribers: [following(AUTHOR), following(REPLIER)],
    });

    expect(planned).toEqual([{ memberId: AUTHOR, type: "human_replied" }]);
  });

  it("never pings the writer even when they mention themselves", () => {
    const planned = planNotifications({
      event: event({
        kind: "user",
        causedByMemberId: REPLIER,
        mentionedMemberIds: [REPLIER, BYSTANDER],
      }),
      subscribers: [following(REPLIER), following(BYSTANDER)],
    });

    expect(planned).toEqual([{ memberId: BYSTANDER, type: "mentioned" }]);
  });

  it("gives each recipient exactly one notification", () => {
    const planned = planNotifications({
      event: event({ mentionedMemberIds: [AUTHOR] }),
      subscribers: [following(AUTHOR), following(AUTHOR)],
    });

    expect(planned).toEqual([{ memberId: AUTHOR, type: "mentioned" }]);
  });

  it("drops recipients the message says nothing to", () => {
    const planned = planNotifications({
      event: event({
        kind: "user",
        parentMessageId: null,
        causedByMemberId: AUTHOR,
      }),
      subscribers: [following(BYSTANDER)],
    });

    expect(planned).toEqual([]);
  });
});

describe("previewOf", () => {
  it("collapses whitespace", () => {
    expect(previewOf("  hello\n\n  world  ")).toBe("hello world");
  });

  it("truncates long text with an ellipsis", () => {
    const preview = previewOf("x".repeat(PREVIEW_LENGTH * 2));
    expect(preview).toHaveLength(PREVIEW_LENGTH);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("leaves short text alone", () => {
    expect(previewOf("ship it")).toBe("ship it");
  });
});
