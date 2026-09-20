import { describe, expect, it } from "vitest";

import {
  applyUnreadDelta,
  hasUnread,
  publishedNotificationId,
  unreadCountKey,
} from "./notification-cache";

const envelope = (notification: unknown) => ({
  type: "notification",
  notification,
});

describe("unreadCountKey", () => {
  it("is stable so every reader shares one cache entry", () => {
    expect(unreadCountKey()).toEqual(unreadCountKey());
  });
});

describe("applyUnreadDelta", () => {
  it("counts up from nothing cached", () => {
    expect(applyUnreadDelta(undefined, 1)).toBe(1);
  });

  it("never falls below zero", () => {
    expect(applyUnreadDelta(0, -1)).toBe(0);
    expect(applyUnreadDelta(2, -5)).toBe(0);
  });
});

describe("hasUnread", () => {
  it("treats an unresolved count as nothing to show", () => {
    expect(hasUnread(undefined)).toBe(false);
  });

  it("shows the dot only above zero", () => {
    expect(hasUnread(0)).toBe(false);
    expect(hasUnread(1)).toBe(true);
  });
});

describe("publishedNotificationId", () => {
  it("reads the id out of a well formed event", () => {
    expect(publishedNotificationId(envelope({ id: "n1" }))).toBe("n1");
  });

  it("ignores events of another type", () => {
    expect(publishedNotificationId({ type: "message", notification: { id: "n1" } })).toBeNull();
  });

  it("ignores anything without a usable id", () => {
    expect(publishedNotificationId(envelope({ id: "" }))).toBeNull();
    expect(publishedNotificationId(envelope({ id: 7 }))).toBeNull();
    expect(publishedNotificationId(envelope(null))).toBeNull();
    expect(publishedNotificationId(null)).toBeNull();
    expect(publishedNotificationId("nope")).toBeNull();
  });
});
