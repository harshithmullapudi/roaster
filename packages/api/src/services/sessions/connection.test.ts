import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const project = {
  id: "project-1",
  supersetOrgId: "superset-org-1",
  supersetHostId: "host-1",
};

let storedKey: string | null = "encrypted-key";
const mintJwt = vi.fn(async (_apiKey: string) => ({
  jwt: "jwt-token",
  claims: { sub: "u", organizationIds: ["o"], exp: nowSeconds() + 3600 },
}));

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

vi.mock("@roster/db", () => ({
  db: {
    query: {
      projects: { findFirst: vi.fn(async () => project) },
      members: {
        findFirst: vi.fn(async () =>
          storedKey ? { supersetKeyEncrypted: storedKey } : undefined,
        ),
      },
    },
  },
  members: { organizationId: "organization_id", supersetOrgId: "superset_org_id" },
  projects: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  eq: vi.fn(() => "eq"),
}));

vi.mock("@roster/superset", () => ({
  mintJwt: (key: string) => mintJwt(key),
  routingKey: (orgId: string, hostId: string) => `${orgId}:${hostId}`,
  tryDecryptApiKey: (encrypted: string) => `decrypted:${encrypted}`,
}));

const load = async () => import("./connection");

const ask = { organizationId: "org-1", projectId: "project-1" };

describe("superset credentials", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    storedKey = "encrypted-key";
    mintJwt.mockClear();
    const { forgetSupersetCredentials } = await load();
    forgetSupersetCredentials();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mints once for a burst of concurrent callers", async () => {
    const { hostConnection } = await load();

    const results = await Promise.all(
      Array.from({ length: 25 }, () => hostConnection(ask)),
    );

    expect(mintJwt).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((r) => r.jwt))).toEqual(new Set(["jwt-token"]));
  });

  it("reuses the token across later calls", async () => {
    const { hostConnection } = await load();

    await hostConnection(ask);
    await hostConnection(ask);
    await hostConnection(ask);

    expect(mintJwt).toHaveBeenCalledTimes(1);
  });

  it("mints again once the token is inside the expiry skew", async () => {
    const { hostConnection } = await load();

    await hostConnection(ask);
    vi.setSystemTime(new Date("2026-09-01T00:59:30Z"));
    await hostConnection(ask);

    expect(mintJwt).toHaveBeenCalledTimes(2);
  });

  it("carries the decrypted key to Superset", async () => {
    const { hostConnection } = await load();

    await hostConnection(ask);

    expect(mintJwt).toHaveBeenCalledWith("decrypted:encrypted-key");
  });

  it("routes to the project's host", async () => {
    const { hostConnection } = await load();

    expect((await hostConnection(ask)).hostKey).toBe("superset-org-1:host-1");
  });

  it("mints a separate token after the stored key changes", async () => {
    const { forgetSupersetCredentials, hostConnection } = await load();

    await hostConnection(ask);
    storedKey = "rotated-key";
    forgetSupersetCredentials();
    await hostConnection(ask);

    expect(mintJwt).toHaveBeenCalledTimes(2);
    expect(mintJwt).toHaveBeenLastCalledWith("decrypted:rotated-key");
  });

  it("refuses when nobody on the team has Superset connected", async () => {
    const { forgetSupersetCredentials, hostConnection } = await load();

    storedKey = null;
    forgetSupersetCredentials();

    await expect(hostConnection(ask)).rejects.toThrow(
      "Nobody on this team has Superset connected.",
    );
  });

  it("does not cache a failed mint", async () => {
    const { hostConnection } = await load();

    mintJwt.mockRejectedValueOnce(new Error("Superset is down"));
    await expect(hostConnection(ask)).rejects.toThrow("Superset is down");

    await expect(hostConnection(ask)).resolves.toMatchObject({
      jwt: "jwt-token",
    });
    expect(mintJwt).toHaveBeenCalledTimes(2);
  });
});
