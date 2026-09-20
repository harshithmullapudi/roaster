import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  decryptApiKey,
  encryptApiKey,
  redact,
  sameApiKey,
  tryDecryptApiKey,
  UndecryptableKeyError,
} from "./crypto";

const KEY = "sk_live_abcdefghijklmnopqrstuvwxyz0123456789";

beforeAll(() => {
  process.env.SUPERSET_KEY_SECRET = randomBytes(32).toString("base64");
});

function storedUnderAnotherSecret(): string {
  const current = process.env.SUPERSET_KEY_SECRET;
  process.env.SUPERSET_KEY_SECRET = randomBytes(32).toString("base64");
  const stored = encryptApiKey(KEY);
  process.env.SUPERSET_KEY_SECRET = current;
  return stored;
}

describe("encryptApiKey / decryptApiKey", () => {
  it("round-trips a key", () => {
    expect(decryptApiKey(encryptApiKey(KEY))).toBe(KEY);
  });

  it("never stores the key in readable form", () => {
    const stored = encryptApiKey(KEY);
    expect(stored).not.toContain(KEY);
    expect(stored).not.toContain("sk_live_");
  });

  it("produces different ciphertext each time, so a fresh IV is really used", () => {
    expect(encryptApiKey(KEY)).not.toBe(encryptApiKey(KEY));
  });

  it("rejects a tampered ciphertext rather than returning garbage", () => {
    const [iv, tag, data] = encryptApiKey(KEY).split(":") as [
      string,
      string,
      string,
    ];
    const flipped = Buffer.from(data, "base64");
    flipped[0] = (flipped[0] as number) ^ 0xff;
    expect(() =>
      decryptApiKey(`${iv}:${tag}:${flipped.toString("base64")}`),
    ).toThrow();
  });

  it("rejects a malformed stored value without describing it", () => {
    expect(() => decryptApiKey("nonsense")).toThrow(UndecryptableKeyError);
  });

  it("reports a key written under a rotated secret as unreadable, not as a crypto fault", () => {
    expect(() => decryptApiKey(storedUnderAnotherSecret())).toThrow(
      UndecryptableKeyError,
    );
  });

  it("tells the reader to reconnect rather than leaking how storage works", () => {
    expect(() => decryptApiKey(storedUnderAnotherSecret())).toThrow(
      /reconnect/i,
    );
  });

  it("refuses a secret that is not 32 bytes", () => {
    const good = process.env.SUPERSET_KEY_SECRET;
    process.env.SUPERSET_KEY_SECRET = Buffer.from("too short").toString("base64");
    expect(() => encryptApiKey(KEY)).toThrow(/32 bytes/);
    process.env.SUPERSET_KEY_SECRET = good;
  });

  it("blames a misconfigured deployment for a misconfigured deployment, rather than telling everyone to reconnect", () => {
    const good = process.env.SUPERSET_KEY_SECRET;
    const stored = encryptApiKey(KEY);
    delete process.env.SUPERSET_KEY_SECRET;
    expect(() => decryptApiKey(stored)).toThrow(/SUPERSET_KEY_SECRET/);
    expect(() => decryptApiKey(stored)).not.toThrow(UndecryptableKeyError);
    expect(() => tryDecryptApiKey(stored)).toThrow(/SUPERSET_KEY_SECRET/);
    process.env.SUPERSET_KEY_SECRET = good;
  });
});

describe("sameApiKey", () => {
  it("matches identical keys and rejects different ones", () => {
    expect(sameApiKey(KEY, KEY)).toBe(true);
    expect(sameApiKey(KEY, `${KEY}x`)).toBe(false);
    expect(sameApiKey(KEY, "sk_live_other")).toBe(false);
  });
});

describe("redact", () => {
  it("strips keys out of text bound for a log or an error", () => {
    const message = `Superset rejected ${KEY} at /api/auth/token`;
    expect(redact(message)).toBe(
      "Superset rejected sk_*** at /api/auth/token",
    );
  });

  it("strips every occurrence, not just the first", () => {
    expect(redact(`${KEY} and ${KEY}`)).toBe("sk_*** and sk_***");
  });

  it("leaves text without a key untouched", () => {
    expect(redact("Could not reach Superset")).toBe("Could not reach Superset");
  });
});
