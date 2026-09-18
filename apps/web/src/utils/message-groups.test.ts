import { describe, expect, it } from "vitest";

import { displayName, speakerName } from "./message-groups";

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
    // The avatar colour is a hash of this string, so the message row and the
    // thread reply stack must agree or one person gets two colours.
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
