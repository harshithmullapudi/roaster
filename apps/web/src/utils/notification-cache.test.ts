import type { NotificationItem } from "@roster/api";
import { describe, expect, it } from "vitest";

import {
  applyUnreadDelta,
  markAllNotificationsRead,
  markNotificationRead,
  notificationLabel,
  notificationsKey,
  parsePublishedNotification,
  prependNotification,
  sortNotifications,
  threadHref,
  unreadBadge,
  unreadCount,
  unreadCountKey,
} from "./notification-cache";

const item = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "n1",
  type: "agent_replied",
  threadId: "t1",
  projectId: "p1",
  channelSlug: "web",
  channelName: "Web",
  messageId: "m1",
  rootText: "Ship the sidebar",
  preview: "Pushed the fix",
  actorDisplay: "Claude",
  readAt: null,
  createdAt: new Date("2026-09-20T10:00:00Z"),
  ...over,
});

const published = (over: Record<string, unknown> = {}) => ({
  type: "notification",
  notification: {
    id: "n9",
    type: "mentioned",
    threadId: "t9",
    projectId: "p9",
    channelSlug: "web",
    messageId: "m9",
    preview: "Can you look at this?",
    actorDisplay: "Harshith",
    createdAt: "2026-09-20T11:00:00.000Z",
    ...over,
  },
});

describe("query keys", () => {
  it("are stable and distinct", () => {
    expect(notificationsKey()).toEqual(["notifications", "list"]);
    expect(unreadCountKey()).toEqual(["notifications", "unread-count"]);
  });
});

describe("sortNotifications", () => {
  it("orders newest first and breaks ties by id", () => {
    const sorted = sortNotifications([
      item({ id: "a", createdAt: new Date("2026-09-20T09:00:00Z") }),
      item({ id: "b", createdAt: new Date("2026-09-20T11:00:00Z") }),
      item({ id: "c", createdAt: new Date("2026-09-20T11:00:00Z") }),
    ]);

    expect(sorted.map((one) => one.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input", () => {
    const list = [
      item({ id: "a", createdAt: new Date("2026-09-20T09:00:00Z") }),
      item({ id: "b", createdAt: new Date("2026-09-20T11:00:00Z") }),
    ];
    sortNotifications(list);
    expect(list.map((one) => one.id)).toEqual(["a", "b"]);
  });
});

describe("prependNotification", () => {
  it("puts a fresh notification on top", () => {
    const list = [item({ id: "a" })];
    const next = prependNotification(
      list,
      item({ id: "b", createdAt: new Date("2026-09-20T12:00:00Z") }),
    );

    expect(next.map((one) => one.id)).toEqual(["b", "a"]);
  });

  it("keeps ordering when an out-of-order event arrives", () => {
    const list = [item({ id: "a", createdAt: new Date("2026-09-20T12:00:00Z") })];
    const next = prependNotification(
      list,
      item({ id: "b", createdAt: new Date("2026-09-20T08:00:00Z") }),
    );

    expect(next.map((one) => one.id)).toEqual(["a", "b"]);
  });

  it("returns the same list when the id is already known", () => {
    const list = [item({ id: "a" })];
    expect(prependNotification(list, item({ id: "a" }))).toBe(list);
  });

  it("caps the cached list", () => {
    const list = Array.from({ length: 50 }, (_, index) =>
      item({
        id: `old-${index}`,
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
      }),
    );

    const next = prependNotification(
      list,
      item({ id: "new", createdAt: new Date("2026-09-20T12:00:00Z") }),
    );

    expect(next).toHaveLength(50);
    expect(next[0]?.id).toBe("new");
    expect(next.some((one) => one.id === "old-0")).toBe(false);
  });
});

describe("markNotificationRead", () => {
  it("stamps readAt on the matching row only", () => {
    const readAt = new Date("2026-09-20T12:00:00Z");
    const next = markNotificationRead(
      [item({ id: "a" }), item({ id: "b" })],
      "a",
      readAt,
    );

    expect(next[0]?.readAt).toEqual(readAt);
    expect(next[1]?.readAt).toBeNull();
  });

  it("returns the same list when unknown or already read", () => {
    const list = [item({ id: "a", readAt: new Date("2026-09-20T09:00:00Z") })];
    expect(markNotificationRead(list, "a")).toBe(list);
    expect(markNotificationRead(list, "missing")).toBe(list);
  });
});

describe("markAllNotificationsRead", () => {
  it("reads every unread row and keeps existing stamps", () => {
    const earlier = new Date("2026-09-20T09:00:00Z");
    const readAt = new Date("2026-09-20T12:00:00Z");
    const next = markAllNotificationsRead(
      [item({ id: "a" }), item({ id: "b", readAt: earlier })],
      readAt,
    );

    expect(next[0]?.readAt).toEqual(readAt);
    expect(next[1]?.readAt).toEqual(earlier);
    expect(unreadCount(next)).toBe(0);
  });

  it("returns the same list when nothing is unread", () => {
    const list = [item({ id: "a", readAt: new Date() })];
    expect(markAllNotificationsRead(list)).toBe(list);
  });
});

describe("unreadCount", () => {
  it("counts rows without a readAt", () => {
    expect(
      unreadCount([
        item({ id: "a" }),
        item({ id: "b", readAt: new Date() }),
        item({ id: "c" }),
      ]),
    ).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
});

describe("applyUnreadDelta", () => {
  it("bumps and clamps at zero", () => {
    expect(applyUnreadDelta(2, 1)).toBe(3);
    expect(applyUnreadDelta(undefined, 1)).toBe(1);
    expect(applyUnreadDelta(0, -1)).toBe(0);
    expect(applyUnreadDelta(undefined, -1)).toBe(0);
  });
});

describe("unreadBadge", () => {
  it("hides at zero and caps the label", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(3)).toBe("3");
    expect(unreadBadge(12)).toBe("9+");
  });
});

describe("notificationLabel", () => {
  it("names every notification type", () => {
    expect(notificationLabel("agent_failed")).toBe("Agent failed");
    expect(notificationLabel("mentioned")).toBe("Mentioned you");
    expect(notificationLabel("delegation_received")).toBe("Handed to you");
  });
});

describe("parsePublishedNotification", () => {
  it("reads the realtime envelope", () => {
    const parsed = parsePublishedNotification(published());

    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe("n9");
    expect(parsed?.type).toBe("mentioned");
    expect(parsed?.createdAt).toEqual(new Date("2026-09-20T11:00:00.000Z"));
    expect(parsed?.readAt).toBeNull();
  });

  it("falls back for fields the publication omits", () => {
    const parsed = parsePublishedNotification(published());

    expect(parsed?.channelName).toBe("web");
    expect(parsed?.rootText).toBe("");
  });

  it("keeps null actors and messages", () => {
    const parsed = parsePublishedNotification(
      published({ actorDisplay: null, messageId: null }),
    );

    expect(parsed?.actorDisplay).toBeNull();
    expect(parsed?.messageId).toBeNull();
  });

  it("rejects other envelopes and malformed payloads", () => {
    expect(parsePublishedNotification(null)).toBeNull();
    expect(parsePublishedNotification({ type: "message" })).toBeNull();
    expect(parsePublishedNotification({ type: "notification" })).toBeNull();
    expect(
      parsePublishedNotification(published({ type: "not_a_type" })),
    ).toBeNull();
    expect(parsePublishedNotification(published({ createdAt: "nope" }))).toBeNull();
    expect(parsePublishedNotification(published({ threadId: 7 }))).toBeNull();
  });
});

describe("threadHref", () => {
  it("links into the thread route", () => {
    expect(threadHref("acme", item({ channelSlug: "web", threadId: "t1" }))).toBe(
      "/acme/web/thread/t1",
    );
  });
});
