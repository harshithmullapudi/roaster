import { randomBytes } from "node:crypto";

import type { SelectMember } from "@roster/db";
import { encryptApiKey } from "@roster/superset";
import { beforeAll, describe, expect, it } from "vitest";

import {
  memberKey,
  NO_MEMBER,
  NOT_CONNECTED,
  OTHER_ORG,
  UNREADABLE_KEY,
} from "./connection";

const KEY = "sk_live_abcdefghijklmnopqrstuvwxyz0123456789";
const ORG = "superset-org-1";

beforeAll(() => {
  process.env.SUPERSET_KEY_SECRET = randomBytes(32).toString("base64");
});

function member(
  supersetKeyEncrypted: string | null,
  supersetOrgId: string | null = ORG,
): SelectMember {
  return { supersetKeyEncrypted, supersetOrgId } as SelectMember;
}

function keyFromARetiredSecret(): string {
  const current = process.env.SUPERSET_KEY_SECRET;
  process.env.SUPERSET_KEY_SECRET = randomBytes(32).toString("base64");
  const stored = encryptApiKey(KEY);
  process.env.SUPERSET_KEY_SECRET = current;
  return stored;
}

describe("memberKey", () => {
  it("reads the key of the member the run belongs to", () => {
    expect(memberKey(member(encryptApiKey(KEY)), ORG)).toEqual({ apiKey: KEY });
  });

  it("has no key to offer when the run has nobody to run as", () => {
    expect(memberKey(null, ORG)).toEqual({ apiKey: null, problem: NO_MEMBER });
  });

  it("asks that member to connect rather than looking for a teammate who has", () => {
    expect(memberKey(member(null), ORG)).toEqual({
      apiKey: null,
      problem: NOT_CONNECTED,
    });
  });

  it("refuses a key connected to a different Superset organization than the machine", () => {
    expect(memberKey(member(encryptApiKey(KEY), "superset-org-2"), ORG)).toEqual(
      { apiKey: null, problem: OTHER_ORG },
    );
  });

  it("asks for a reconnect when the stored key outlived its secret", () => {
    expect(memberKey(member(keyFromARetiredSecret()), ORG)).toEqual({
      apiKey: null,
      problem: UNREADABLE_KEY,
    });
  });

  it("asks for a reconnect for a stored value that is not in the stored format at all", () => {
    expect(memberKey(member("nonsense"), ORG)).toEqual({
      apiKey: null,
      problem: UNREADABLE_KEY,
    });
  });
});
