import { describe, expect, it } from "vitest";

import { can, capabilitiesFor, normalizeRole } from "./access";

describe("normalizeRole", () => {
  it("keeps the roles we know", () => {
    expect(normalizeRole("owner")).toBe("owner");
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("member")).toBe("member");
  });

  it("falls back to member for anything else", () => {
    expect(normalizeRole("superadmin")).toBe("member");
    expect(normalizeRole("")).toBe("member");
    expect(normalizeRole(null)).toBe("member");
    expect(normalizeRole(undefined)).toBe("member");
  });
});

describe("can", () => {
  it("lets owners and admins change channel settings", () => {
    expect(can("owner", "channel:update")).toBe(true);
    expect(can("admin", "channel:update")).toBe(true);
  });

  it("keeps plain members out of channel settings", () => {
    expect(can("member", "channel:update")).toBe(false);
  });

  it("treats an unknown role as a plain member", () => {
    expect(can("guest", "member:invite")).toBe(false);
    expect(can(null, "member:remove")).toBe(false);
  });
});

describe("capabilitiesFor", () => {
  it("gives members nothing", () => {
    expect(capabilitiesFor("member")).toHaveLength(0);
  });

  it("gives owners every capability", () => {
    expect(capabilitiesFor("owner")).toContain("channel:update");
    expect(capabilitiesFor("owner")).toContain("member:role");
  });
});
