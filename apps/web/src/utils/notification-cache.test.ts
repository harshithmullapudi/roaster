import { describe, expect, it } from "vitest";

import {
  applyUnreadDelta,
  notificationBody,
  notificationTitle,
  NOTIFICATION_TYPES,
  parsePublishedNotification,
  type PublishedNotification,
  unreadCountKey,
} from "./notification-cache";

const envelope = (notification: unknown) => ({
  type: "notification",
  notification,
});

const published = (
  over: Partial<PublishedNotification> = {},
): PublishedNotification => ({
  id: "n1",
  type: "agent_replied",
  threadId: "t1",
  projectId: "p1",
  channelSlug: "core",
  preview: "Added a sliding-window limiter.",
  actorDisplay: "harshith [core]",
  ...over,
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

describe("parsePublishedNotification", () => {
  it("reads a well formed event", () => {
    const parsed = parsePublishedNotification(
      envelope({
        id: "n1",
        type: "mentioned",
        threadId: "t1",
        projectId: "p1",
        channelSlug: "core",
        preview: "look at this",
        actorDisplay: "Ada Okafor",
      }),
    );
    expect(parsed?.id).toBe("n1");
    expect(parsed?.type).toBe("mentioned");
    expect(parsed?.actorDisplay).toBe("Ada Okafor");
  });

  it("ignores events of another type", () => {
    expect(
      parsePublishedNotification({ type: "message", notification: { id: "n1" } }),
    ).toBeNull();
  });

  it("rejects a type the client does not know", () => {
    expect(
      parsePublishedNotification(envelope({ id: "n1", type: "invented" })),
    ).toBeNull();
  });

  it("ignores anything without a usable id", () => {
    expect(
      parsePublishedNotification(envelope({ id: "", type: "agent_replied" })),
    ).toBeNull();
    expect(parsePublishedNotification(envelope(null))).toBeNull();
    expect(parsePublishedNotification(null)).toBeNull();
  });

  it("treats a blank actor as no actor, so the title can fall back", () => {
    const parsed = parsePublishedNotification(
      envelope({ id: "n1", type: "agent_replied", actorDisplay: "" }),
    );
    expect(parsed?.actorDisplay).toBeNull();
  });
});

describe("notificationTitle", () => {
  it("names the agent and what it did", () => {
    expect(notificationTitle(published())).toBe("harshith [core] replied");
  });

  it("reads as a person for a mention", () => {
    expect(
      notificationTitle(
        published({ type: "mentioned", actorDisplay: "Ada Okafor" }),
      ),
    ).toBe("Ada Okafor mentioned you");
  });

  it("separates a failure from a reply", () => {
    expect(notificationTitle(published({ type: "agent_failed" }))).toBe(
      "harshith [core] could not finish",
    );
  });

  it("falls back when nobody is named", () => {
    expect(notificationTitle(published({ actorDisplay: null }))).toBe(
      "Your agent replied",
    );
  });

  it("has a verb for every type", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(notificationTitle(published({ type }))).not.toMatch(/undefined/);
    }
  });
});

describe("notificationBody", () => {
  it("leads with the channel so a stacked notification still says where", () => {
    expect(notificationBody(published())).toBe(
      "#core · Added a sliding-window limiter.",
    );
  });

  it("drops the separator when there is no preview", () => {
    expect(notificationBody(published({ preview: "   " }))).toBe("#core");
  });

  it("still says something when it knows nothing", () => {
    expect(
      notificationBody(published({ preview: "", channelSlug: "" })),
    ).toBe("Open Roster to see what changed.");
  });
});
