import { describe, expect, it, vi } from "vitest";

import {
  createJwtCache,
  fingerprint,
  JWT_FALLBACK_TTL_MS,
  JWT_SKEW_MS,
  jwtLifetime,
} from "./jwt-cache";

const NOW = 1_700_000_000_000;

function clock(start = NOW) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("fingerprint", () => {
  it("is stable for the same input", () => {
    expect(fingerprint("abc")).toBe(fingerprint("abc"));
  });

  it("separates different keys", () => {
    expect(fingerprint("abc")).not.toBe(fingerprint("abd"));
  });

  it("does not leak the input", () => {
    expect(fingerprint("sk_live_secret")).not.toContain("sk_live_secret");
  });
});

describe("jwtLifetime", () => {
  it("retires a token before it actually expires", () => {
    const exp = Math.floor((NOW + 10 * 60_000) / 1000);
    expect(jwtLifetime(exp, NOW)).toBe(exp * 1000 - JWT_SKEW_MS);
  });

  it("falls back when the token carries no expiry", () => {
    expect(jwtLifetime(0, NOW)).toBe(NOW + JWT_FALLBACK_TTL_MS - JWT_SKEW_MS);
  });
});

describe("createJwtCache", () => {
  const minted = (jwt: string, minutes = 10) => ({
    jwt,
    exp: Math.floor((NOW + minutes * 60_000) / 1000),
  });

  it("mints once and serves the rest from cache", async () => {
    const mint = vi.fn(async () => minted("jwt-1"));
    const time = clock();
    const cache = createJwtCache(mint, time.now);

    expect(await cache.get("api")).toBe("jwt-1");
    expect(await cache.get("api")).toBe("jwt-1");
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it("shares one mint between concurrent callers", async () => {
    let release: (value: { jwt: string; exp: number }) => void = () => {};
    const mint = vi.fn(
      () =>
        new Promise<{ jwt: string; exp: number }>((resolve) => {
          release = resolve;
        }),
    );
    const cache = createJwtCache(mint, clock().now);

    const both = Promise.all([cache.get("api"), cache.get("api")]);
    release(minted("jwt-1"));

    expect(await both).toEqual(["jwt-1", "jwt-1"]);
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it("mints again once the token has aged out", async () => {
    const mint = vi
      .fn()
      .mockResolvedValueOnce(minted("jwt-1"))
      .mockResolvedValueOnce(minted("jwt-2"));
    const time = clock();
    const cache = createJwtCache(mint, time.now);

    expect(await cache.get("api")).toBe("jwt-1");
    time.advance(10 * 60_000);
    expect(await cache.get("api")).toBe("jwt-2");
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it("keeps different keys apart", async () => {
    const mint = vi
      .fn()
      .mockResolvedValueOnce(minted("jwt-a"))
      .mockResolvedValueOnce(minted("jwt-b"));
    const cache = createJwtCache(mint, clock().now);

    expect(await cache.get("api-a")).toBe("jwt-a");
    expect(await cache.get("api-b")).toBe("jwt-b");
  });

  it("does not remember a failed mint", async () => {
    const mint = vi
      .fn()
      .mockRejectedValueOnce(new Error("superset unreachable"))
      .mockResolvedValueOnce(minted("jwt-1"));
    const cache = createJwtCache(mint, clock().now);

    await expect(cache.get("api")).rejects.toThrow("superset unreachable");
    expect(await cache.get("api")).toBe("jwt-1");
  });

  it("mints again after being cleared", async () => {
    const mint = vi
      .fn()
      .mockResolvedValueOnce(minted("jwt-1"))
      .mockResolvedValueOnce(minted("jwt-2"));
    const cache = createJwtCache(mint, clock().now);

    expect(await cache.get("api")).toBe("jwt-1");
    cache.clear();
    expect(await cache.get("api")).toBe("jwt-2");
  });
});
