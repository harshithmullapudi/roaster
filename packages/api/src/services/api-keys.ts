import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

import { apiKeys, db, members } from "@roster/db";
import { and, eq, isNull } from "drizzle-orm";

const PREFIX = "rst";
const SECRET_BYTES = 32;

export interface MintedKey {
  id: string;
  name: string;
  /** Shown once, at creation. Never recoverable afterwards. */
  key: string;
  prefix: string;
  createdAt: Date;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * `rst_<43 url-safe chars>`. The prefix makes a leaked key greppable in logs
 * and recognisable to its owner; the entropy is all in the tail.
 */
function generateKey(): string {
  return `${PREFIX}_${randomBytes(SECRET_BYTES).toString("base64url")}`;
}

export async function mintApiKey(args: {
  organizationId: string;
  memberId: string;
  name: string;
}): Promise<MintedKey> {
  const key = generateKey();

  const [row] = await db
    .insert(apiKeys)
    .values({
      organizationId: args.organizationId,
      memberId: args.memberId,
      name: args.name.trim() || "CLI",
      prefix: key.slice(0, PREFIX.length + 9),
      hash: hashKey(key),
    })
    .returning();

  if (!row) throw new Error("Could not create that key.");

  return {
    id: row.id,
    name: row.name,
    key,
    prefix: row.prefix,
    createdAt: row.createdAt,
  };
}

export interface KeyHolder {
  keyId: string;
  organizationId: string;
  memberId: string;
}

/**
 * Looks a key up by hash. Constant-time comparison is redundant given the
 * lookup is already by digest, but costs nothing and keeps the intent obvious
 * if this ever grows a scan.
 */
export async function verifyApiKey(
  presented: string,
): Promise<KeyHolder | null> {
  const token = presented.trim();
  if (!token.startsWith(`${PREFIX}_`)) return null;

  const digest = hashKey(token);

  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.hash, digest), isNull(apiKeys.revokedAt)),
  });
  if (!row) return null;

  const a = Buffer.from(row.hash, "hex");
  const b = Buffer.from(digest, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));

  return {
    keyId: row.id,
    organizationId: row.organizationId,
    memberId: row.memberId,
  };
}

export async function listApiKeys(memberId: string) {
  const rows = await db.query.apiKeys.findMany({
    where: and(eq(apiKeys.memberId, memberId), isNull(apiKeys.revokedAt)),
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  }));
}

export async function revokeApiKey(args: {
  memberId: string;
  keyId: string;
}): Promise<boolean> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, args.keyId), eq(apiKeys.memberId, args.memberId)))
    .returning({ id: apiKeys.id });

  return Boolean(row);
}

/** The member a key acts as, with the role its permissions are drawn from. */
export async function keyHolderMember(holder: KeyHolder) {
  const member = await db.query.members.findFirst({
    where: eq(members.id, holder.memberId),
  });
  return member ?? null;
}
