import {
  db,
  members,
  projects,
  type SelectMember,
  type SelectProject,
} from "@roster/db";
import { mintJwt, routingKey, tryDecryptApiKey } from "@roster/superset";
import { and, eq } from "drizzle-orm";

import { createJwtCache } from "../../lib/jwt-cache";

const jwts = createJwtCache(async (apiKey) => {
  const { jwt, claims } = await mintJwt(apiKey);
  return { jwt, exp: claims.exp };
});

export function forgetSupersetCredentials(): void {
  jwts.clear();
}

export interface HostConnection {
  jwt: string;
  project: SelectProject;
  hostKey: string;
  memberId: string;
}

export type MemberAuth = { jwt: string } | { jwt: null; problem: string };

export const NO_MEMBER =
  "This run has nobody to run as, so there is no Superset key to reach the machine with.";
export const NOT_CONNECTED =
  "You have not connected Superset. Connect it in settings to reach your machines.";
export const UNREADABLE_KEY =
  "Your stored Superset key can no longer be read. Reconnect Superset in settings.";
export const OTHER_ORG =
  "Your Superset connection is to a different organization than this channel's machine. Switch it in settings.";

export type MemberKey = { apiKey: string } | { apiKey: null; problem: string };

type KeyHolder = Pick<SelectMember, "supersetKeyEncrypted" | "supersetOrgId">;

export function memberKey(
  member: KeyHolder | null | undefined,
  supersetOrgId: string,
): MemberKey {
  if (!member) return { apiKey: null, problem: NO_MEMBER };
  if (!member.supersetKeyEncrypted) {
    return { apiKey: null, problem: NOT_CONNECTED };
  }
  if (member.supersetOrgId !== supersetOrgId) {
    return { apiKey: null, problem: OTHER_ORG };
  }

  const apiKey = tryDecryptApiKey(member.supersetKeyEncrypted);
  if (!apiKey) return { apiKey: null, problem: UNREADABLE_KEY };

  return { apiKey };
}

export async function hostConnection(args: {
  organizationId: string;
  projectId: string;
  runAsMemberId: string | null;
}): Promise<HostConnection> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, args.projectId),
  });
  if (!project) throw new Error("This channel is no longer linked to a project.");

  const member = args.runAsMemberId
    ? await db.query.members.findFirst({
        where: and(
          eq(members.id, args.runAsMemberId),
          eq(members.organizationId, args.organizationId),
        ),
      })
    : null;

  const key = memberKey(member, project.supersetOrgId);
  if (key.apiKey === null) throw new Error(key.problem);

  return {
    jwt: await jwts.get(key.apiKey),
    project,
    hostKey: routingKey(project.supersetOrgId, project.supersetHostId),
    memberId: member!.id,
  };
}

export async function jwtForMember(args: {
  memberId: string;
  hostKey: string;
}): Promise<MemberAuth> {
  const [supersetOrgId] = args.hostKey.split(":");
  if (!supersetOrgId) return { jwt: null, problem: NO_MEMBER };

  const member = await db.query.members.findFirst({
    where: eq(members.id, args.memberId),
  });

  const key = memberKey(member, supersetOrgId);
  if (key.apiKey === null) return { jwt: null, problem: key.problem };

  return { jwt: await jwts.get(key.apiKey) };
}
