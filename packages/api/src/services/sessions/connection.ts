import { db, members, projects, type SelectProject } from "@roster/db";
import { mintJwt, routingKey, tryDecryptApiKey } from "@roster/superset";
import { and, eq } from "drizzle-orm";

export interface HostConnection {
  jwt: string;
  project: SelectProject;
  hostKey: string;
}

export async function hostConnection(args: {
  organizationId: string;
  projectId: string;
}): Promise<HostConnection> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, args.projectId),
  });
  if (!project) throw new Error("This channel is no longer linked to a project.");

  const member = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, args.organizationId),
      eq(members.supersetOrgId, project.supersetOrgId),
    ),
  });
  if (!member?.supersetKeyEncrypted) {
    throw new Error("Nobody on this team has Superset connected.");
  }

  const apiKey = tryDecryptApiKey(member.supersetKeyEncrypted);
  if (!apiKey) {
    throw new Error(
      "This team's stored Superset key can no longer be read. Reconnect Superset in settings.",
    );
  }

  const { jwt } = await mintJwt(apiKey);
  return {
    jwt,
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
  const apiKey = tryDecryptApiKey(member.supersetKeyEncrypted);
  if (!apiKey) return null;
  const { jwt } = await mintJwt(apiKey);
  return jwt;
}
