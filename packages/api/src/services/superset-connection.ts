import { db, members, projects, type SelectMember } from "@roster/db";
import {
  decryptApiKey,
  encryptApiKey,
  listHosts,
  listProjects,
  mintJwt,
  SupersetError,
  type SupersetHost,
  type SupersetProject,
} from "@roster/superset";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";

import { slugifyProject, uniqueProjectSlug } from "../utils/project-slug";

export interface ConnectResult {
  supersetOrgId: string;
  hostCount: number;
}

export async function connectSuperset(args: {
  memberId: string;
  apiKey: string;
}): Promise<ConnectResult> {
  const session = await mintJwt(args.apiKey);
  const supersetOrgId = session.claims.organizationIds[0]!;

  const hosts = await listHosts(session.jwt, supersetOrgId);

  await db
    .update(members)
    .set({
      supersetKeyEncrypted: encryptApiKey(args.apiKey),
      supersetOrgId,
      supersetConnectedAt: new Date(),
    })
    .where(eq(members.id, args.memberId));

  return { supersetOrgId, hostCount: hosts.length };
}

async function sessionFor(member: SelectMember) {
  if (!member.supersetKeyEncrypted || !member.supersetOrgId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Superset is not connected for this member.",
    });
  }
  const { jwt } = await mintJwt(decryptApiKey(member.supersetKeyEncrypted));
  return { jwt, supersetOrgId: member.supersetOrgId };
}

export async function hostsFor(member: SelectMember): Promise<SupersetHost[]> {
  const { jwt, supersetOrgId } = await sessionFor(member);
  return listHosts(jwt, supersetOrgId);
}

export interface HostProjects {
  host: SupersetHost;
  projects: SupersetProject[];
  error: string | null;
}

export async function projectsForAllHosts(
  member: SelectMember,
): Promise<HostProjects[]> {
  const { jwt, supersetOrgId } = await sessionFor(member);
  const hosts = await listHosts(jwt, supersetOrgId);

  return Promise.all(
    hosts.map(async (host) => {
      if (!host.online) {
        return { host, projects: [], error: null };
      }
      try {
        return {
          host,
          projects: await listProjects(jwt, supersetOrgId, host.id),
          error: null,
        };
      } catch (cause) {
        const error =
          cause instanceof SupersetError
            ? cause.message
            : "That machine did not answer.";
        return { host, projects: [], error };
      }
    }),
  );
}

export interface SelectedProject {
  supersetProjectId: string;
  supersetHostId: string;
  name: string;
  repoOwner: string | null;
  repoName: string | null;
  repoUrl: string | null;
  repoPath: string | null;
}

export async function saveProjects(args: {
  organizationId: string;
  memberId: string;
  selected: SelectedProject[];
}): Promise<number> {
  if (args.selected.length === 0) return 0;

  const existing = await db.query.projects.findMany({
    where: eq(projects.organizationId, args.organizationId),
    columns: { slug: true, supersetProjectId: true },
  });

  const taken = new Set(existing.map((row) => row.slug));
  const alreadyAdded = new Set(existing.map((row) => row.supersetProjectId));

  const rows = args.selected
    .filter((project) => !alreadyAdded.has(project.supersetProjectId))
    .map((project) => {
      const slug = uniqueProjectSlug(slugifyProject(project.name), taken);
      taken.add(slug);
      return {
        organizationId: args.organizationId,
        supersetProjectId: project.supersetProjectId,
        supersetHostId: project.supersetHostId,
        name: project.name,
        slug,
        repoOwner: project.repoOwner,
        repoName: project.repoName,
        repoUrl: project.repoUrl,
        repoPath: project.repoPath,
        addedByMemberId: args.memberId,
      };
    });

  if (rows.length === 0) return 0;

  await db.insert(projects).values(rows).onConflictDoNothing();
  return rows.length;
}

export async function listOrgProjects(organizationId: string) {
  return db.query.projects.findMany({
    where: eq(projects.organizationId, organizationId),
    orderBy: projects.createdAt,
  });
}

export async function removeProjects(args: {
  organizationId: string;
  projectIds: string[];
}) {
  if (args.projectIds.length === 0) return;
  await db
    .delete(projects)
    .where(
      and(
        eq(projects.organizationId, args.organizationId),
        inArray(projects.id, args.projectIds),
      ),
    );
}
