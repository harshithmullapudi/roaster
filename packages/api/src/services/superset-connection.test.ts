import { randomBytes } from "node:crypto";

import type { SelectMember } from "@roster/db";
import { encryptApiKey } from "@roster/superset";
import { beforeAll, describe, expect, it } from "vitest";

import { supersetConnectionFor } from "./superset-connection";

const KEY = "sk_live_abcdefghijklmnopqrstuvwxyz0123456789";

beforeAll(() => {
  process.env.SUPERSET_KEY_SECRET = randomBytes(32).toString("base64");
});

function memberWith(supersetKeyEncrypted: string | null): SelectMember {
  return {
    id: "member-1",
    supersetKeyEncrypted,
    supersetOrgId: "org-1",
    supersetConnectedAt: new Date("2026-09-01"),
  } as SelectMember;
}

function keyFromARetiredSecret(): string {
  const current = process.env.SUPERSET_KEY_SECRET;
  process.env.SUPERSET_KEY_SECRET = randomBytes(32).toString("base64");
  const stored = encryptApiKey(KEY);
  process.env.SUPERSET_KEY_SECRET = current;
  return stored;
}

describe("supersetConnectionFor", () => {
  it("reports no connection when nothing was ever stored", async () => {
    await expect(supersetConnectionFor(memberWith(null))).resolves.toEqual({
      connected: false,
      organizationId: null,
      organizationName: null,
      connectedAt: null,
    });
  });

  it("reports no connection when the stored key outlived its secret, so the member can paste a new one", async () => {
    await expect(
      supersetConnectionFor(memberWith(keyFromARetiredSecret())),
    ).resolves.toEqual({
      connected: false,
      organizationId: null,
      organizationName: null,
      connectedAt: null,
    });
  });

  it("reports no connection for a stored value that is not in the stored format at all", async () => {
    await expect(
      supersetConnectionFor(memberWith("nonsense")),
    ).resolves.toEqual({
      connected: false,
      organizationId: null,
      organizationName: null,
      connectedAt: null,
    });
  });
});
