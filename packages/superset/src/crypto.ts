import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function secret(): Buffer {
  const raw = process.env.SUPERSET_KEY_SECRET;
  if (!raw) {
    throw new Error(
      "SUPERSET_KEY_SECRET is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `SUPERSET_KEY_SECRET must decode to ${KEY_BYTES} bytes, got ${key.length}. ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

export function encryptApiKey(apiKey: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, secret(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export class UndecryptableKeyError extends Error {
  constructor() {
    super("That stored Superset key can no longer be read. Reconnect Superset.");
    this.name = "UndecryptableKeyError";
  }
}

export function decryptApiKey(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new UndecryptableKeyError();
  }
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      secret(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (cause) {
    if (cause instanceof Error && /SUPERSET_KEY_SECRET/.test(cause.message)) {
      throw cause;
    }
    throw new UndecryptableKeyError();
  }
}

export function tryDecryptApiKey(stored: string): string | null {
  try {
    return decryptApiKey(stored);
  } catch (cause) {
    if (cause instanceof UndecryptableKeyError) return null;
    throw cause;
  }
}

export function sameApiKey(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function redact(text: string): string {
  return text.replace(/sk_(live|test)_[A-Za-z0-9._-]+/g, "sk_***");
}
