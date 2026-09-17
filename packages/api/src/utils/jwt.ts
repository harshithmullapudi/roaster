import { createHmac } from "node:crypto";

function encode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function signHs256(
  claims: Record<string, unknown>,
  secret: string,
): string {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const signature = encode(
    createHmac("sha256", secret).update(signingInput).digest(),
  );
  return `${signingInput}.${signature}`;
}

export function expiresIn(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}
