import { createHash } from "node:crypto";

import { db, members, projects, type SelectProject } from "@roster/db";
import { mintJwt, routingKey, tryDecryptApiKey } from "@roster/superset";
import { and, eq } from "drizzle-orm";

const CREDENTIAL_TTL_MS = 30_000;
const JWT_SKEW_MS = 60_000;
const JWT_FALLBACK_TTL_MS = 5 * 60 * 1000;

export interface HostConnection {
  jwt: string;
  project: SelectProject;
  hostKey: string;
}

interface CachedJwt {
  jwt: string;
  expiresAt: number;
}

interface CachedCredential {
  project: SelectProject | null;
  encrypted: string | null;
  expiresAt: number;
}

const jwts = new Map<string, CachedJwt>();
const inflight = new Map<string, Promise<string>>();
const credentials = new Map<string, CachedCredential>();

function fingerprint(encrypted: string): string {
  return createHash("sha256").update(encrypted).digest("base64url");
}

function jwtLifetime(exp: number): number {
  const expiresAt = exp > 0 ? exp * 1000 : Date.now() + JWT_FALLBACK_TTL_MS;
  return expiresAt - JWT_SKEW_MS;
}

async function jwtFor(encrypted: string): Promise<string> {
  const key = fingerprint(encrypted);

  const cached = jwts.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.jwt;

  const pending = inflight.get(key);
  if (pending) return pending;

  const minting = (async () => {
    const apiKey = tryDecryptApiKey(encrypted);
    if (!apiKey) {
      throw new Error(
        "This team's stored Superset key can no longer be read. Reconnect Superset in settings.",
      );
    }

    const { jwt, claims } = await mintJwt(apiKey);
    jwts.set(key, { jwt, expiresAt: jwtLifetime(claims.exp) });
    return jwt;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, minting);
  return minting;
}

async function credentialFor(args: {
  organizationId: string;
  projectId: string;
}): Promise<CachedCredential> {
  const key = `${args.organizationId}:${args.projectId}`;

  const cached = credentials.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const project =
    (await db.query.projects.findFirst({
      where: eq(projects.id, args.projectId),
    })) ?? null;

  const member = project
    ? ((await db.query.members.findFirst({
        where: and(
          eq(members.organizationId, args.organizationId),
          eq(members.supersetOrgId, project.supersetOrgId),
        ),
      })) ?? null)
    : null;

  const fresh: CachedCredential = {
    project,
    encrypted: member?.supersetKeyEncrypted ?? null,
    expiresAt: Date.now() + CREDENTIAL_TTL_MS,
  };
  credentials.set(key, fresh);
  return fresh;
}

export async function hostConnection(args: {
  organizationId: string;
  projectId: string;
}): Promise<HostConnection> {
  const { project, encrypted } = await credentialFor(args);

  if (!project) {
    throw new Error("This channel is no longer linked to a project.");
  }
  if (!encrypted) {
    throw new Error("Nobody on this team has Superset connected.");
  }

  return {
    jwt: await jwtFor(encrypted),
    project,
    hostKey: routingKey(project.supersetOrgId, project.supersetHostId),
  };
}

export async function jwtForHostKey(hostKey: string): Promise<string | null> {
  const supersetOrgId = hostKey.split(":")[0];
  if (!supersetOrgId) return null;

  const member = await db.query.members.findFirst({
    where: eq(members.supersetOrgId, supersetOrgId),
  });
  if (!member?.supersetKeyEncrypted) return null;

  try {
    return await jwtFor(member.supersetKeyEncrypted);
  } catch {
    return null;
  }
}

export function forgetSupersetCredentials(): void {
  jwts.clear();
  credentials.clear();
}
