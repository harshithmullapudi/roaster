import { createHash } from "node:crypto";

export const JWT_SKEW_MS = 60_000;
export const JWT_FALLBACK_TTL_MS = 5 * 60 * 1000;

export interface MintedJwt {
  jwt: string;
  exp: number;
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function jwtLifetime(exp: number, now: number = Date.now()): number {
  const expiresAt = exp > 0 ? exp * 1000 : now + JWT_FALLBACK_TTL_MS;
  return expiresAt - JWT_SKEW_MS;
}

export interface JwtCache {
  get(apiKey: string): Promise<string>;
  clear(): void;
  size(): number;
}

export function createJwtCache(
  mint: (apiKey: string) => Promise<MintedJwt>,
  now: () => number = Date.now,
): JwtCache {
  const minted = new Map<string, { jwt: string; expiresAt: number }>();
  const inflight = new Map<string, Promise<string>>();

  return {
    async get(apiKey: string): Promise<string> {
      const cacheKey = fingerprint(apiKey);

      const cached = minted.get(cacheKey);
      if (cached && cached.expiresAt > now()) return cached.jwt;

      const pending = inflight.get(cacheKey);
      if (pending) return pending;

      const minting = mint(apiKey)
        .then((result) => {
          minted.set(cacheKey, {
            jwt: result.jwt,
            expiresAt: jwtLifetime(result.exp, now()),
          });
          return result.jwt;
        })
        .finally(() => {
          inflight.delete(cacheKey);
        });

      inflight.set(cacheKey, minting);
      return minting;
    },

    clear(): void {
      minted.clear();
    },

    size(): number {
      return minted.size;
    },
  };
}
