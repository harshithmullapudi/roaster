import { describe, expect, it } from "vitest";

import { displayName, speakerName, startsNewGroup } from "./message-groups";

describe("startsNewGroup", () => {
  const at = (seconds: number) => new Date(2026, 0, 1, 12, 0, seconds);
  const said = (memberId: string, seconds: number) => ({
    authorMemberId: memberId,
    createdAt: at(seconds),
  });

  it("starts a group when there is nothing above", () => {
    expect(startsNewGroup(said("harshith", 0), undefined)).toBe(true);
  });

  it("keeps the same speaker together inside the window", () => {
    expect(startsNewGroup(said("harshith", 30), said("harshith", 0))).toBe(
      false,
    );
  });

  it("breaks on a different speaker", () => {
    expect(startsNewGroup(said("rhea", 30), said("harshith", 0))).toBe(true);
  });

  it("breaks once the window has passed", () => {
    expect(startsNewGroup(said("harshith", 600), said("harshith", 0))).toBe(
      true,
    );
  });

  it("breaks after a message that started a thread", () => {
    expect(
      startsNewGroup(said("harshith", 30), said("harshith", 0), true),
    ).toBe(true);
  });

  it("still groups when the message above has no thread", () => {
    expect(
      startsNewGroup(said("harshith", 30), said("harshith", 0), false),
    ).toBe(false);
  });
});

describe("displayName", () => {
  it("uses the name when there is one", () => {
    expect(displayName("Harshith", "harshith@tegon.ai")).toBe("Harshith");
  });

  it("falls back to the part of the email before the @", () => {
    expect(displayName(null, "born4rhell@gmail.com")).toBe("born4rhell");
    expect(displayName("   ", "born4rhell@gmail.com")).toBe("born4rhell");
  });

  it("keeps an address it cannot split", () => {
    expect(displayName(null, "operator")).toBe("operator");
  });

  it("says Unknown when there is nothing to go on", () => {
    expect(displayName(null, null)).toBe("Unknown");
  });
});

describe("speakerName", () => {
  const user = {
    kind: "user",
    authorName: null,
    authorEmail: "born4rhell@gmail.com",
    agentDisplay: null,
  };

  it("names a user the way the header does", () => {
    expect(speakerName(user)).toBe("born4rhell");
  });

  it("gives the same string wherever the avatar is drawn", () => {
    expect(speakerName(user)).toBe(speakerName({ ...user }));
  });

  it("names the agent that actually spoke", () => {
    expect(
      speakerName({
        kind: "agent",
        authorName: null,
        authorEmail: null,
        agentDisplay: "fern [core]",
      }),
    ).toBe("fern [core]");
  });

  it("falls back to Agent when the channel is gone", () => {
    expect(
      speakerName({
        kind: "agent",
        authorName: null,
        authorEmail: null,
        agentDisplay: null,
      }),
    ).toBe("Agent");
  });
});
