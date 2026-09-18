import { describe, expect, it } from "vitest";

import { type DeletableMessage, deleteRefusal } from "./message-delete";

const ME = "11111111-1111-1111-1111-111111111111";
const SOMEONE_ELSE = "22222222-2222-2222-2222-222222222222";

const mine: DeletableMessage = {
  kind: "user",
  authorMemberId: ME,
  deletedAt: null,
};

const message = (over: Partial<DeletableMessage> = {}): DeletableMessage => ({
  ...mine,
  ...over,
});

describe("deleteRefusal", () => {
  it("lets you take back your own message", () => {
    expect(deleteRefusal(mine, ME)).toBeNull();
  });

  it("refuses someone else's message", () => {
    expect(deleteRefusal(message({ authorMemberId: SOMEONE_ELSE }), ME)).toBe(
      "not-yours",
    );
  });

  it("refuses agent output, even in your own thread", () => {
    expect(
      deleteRefusal(message({ kind: "agent", authorMemberId: null }), ME),
    ).toBe("not-yours");
  });

  it("refuses a delegation record", () => {
    expect(
      deleteRefusal(message({ kind: "delegation", authorMemberId: null }), ME),
    ).toBe("not-yours");
  });

  it("refuses an authorless message rather than matching null to null", () => {
    expect(
      deleteRefusal(message({ authorMemberId: null }), ME),
    ).toBe("not-yours");
  });

  it("reports a missing message", () => {
    expect(deleteRefusal(null, ME)).toBe("missing");
  });

  it("reports a message already deleted, before checking the author", () => {
    expect(deleteRefusal(message({ deletedAt: new Date() }), ME)).toBe(
      "already-deleted",
    );
  });
});
