import { describe, expect, it } from "vitest";

import { decodeJwtClaims } from "./jwt";

function token(payload: unknown): string {
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64(payload)}.signature`;
}

const ORG = "dfd887a8-1cda-4ee0-a16a-6be7f0f56e58";

describe("decodeJwtClaims", () => {
  it("reads the claims Superset's jwt plugin puts in definePayload", () => {
    const claims = decodeJwtClaims(
      token({ sub: "user-1", organizationIds: [ORG], exp: 1789817705 }),
    );
    expect(claims).toEqual({
      sub: "user-1",
      organizationIds: [ORG],
      exp: 1789817705,
    });
  });

  it("keeps every organization when a key spans several", () => {
    const second = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(
      decodeJwtClaims(token({ sub: "u", organizationIds: [ORG, second] }))
        .organizationIds,
    ).toEqual([ORG, second]);
  });

  it("rejects a string that is not a JWT", () => {
    expect(() => decodeJwtClaims("not-a-jwt")).toThrow(/not a JWT/);
  });

  it("rejects an unreadable payload", () => {
    expect(() => decodeJwtClaims("a.!!!not-base64-json!!!.c")).toThrow(
      /unreadable/,
    );
  });

  it("rejects a token with no organizations instead of returning none", () => {
    expect(() => decodeJwtClaims(token({ sub: "u", organizationIds: [] }))).toThrow(
      /carries no organizations/,
    );
    expect(() => decodeJwtClaims(token({ sub: "u" }))).toThrow(
      /carries no organizations/,
    );
  });

  it("rejects a token with no subject", () => {
    expect(() => decodeJwtClaims(token({ organizationIds: [ORG] }))).toThrow(
      /missing its subject/,
    );
  });
});
