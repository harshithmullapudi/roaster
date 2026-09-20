import { db, members, projects, type SelectMember } from "@roster/db";
import {
  decodeJwtClaims,
  encryptApiKey,
  getOrganization,
  listHosts,
  listOrganizations,
  listProjects,
  mintJwt,
  SupersetError,
  tryDecryptApiKey,
  UndecryptableKeyError,
  type SupersetHost,
  type SupersetOrganization,
  type SupersetProject,
} from "@roster/superset";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";

import { slugifyProject, uniqueProjectSlug } from "../utils/project-slug";
import { forgetSupersetCredentials } from "./sessions/connection";

export interface ConnectResult {
  organizations: SupersetOrganization[];
  chosenOrganizationId: string | null;
}

export async function connectSuperset(args: {
  memberId: string;
  apiKey: string;
}): Promise<ConnectResult> {
  const { jwt, claims } = await mintJwt(args.apiKey);
  const organizations = await listOrganizations(jwt, claims.organizationIds);

  const only = organizations.length === 1 ? organizations[0]! : null;

  await db
    .update(members)
    .set({
      supersetKeyEncrypted: encryptApiKey(args.apiKey),
      supersetOrgId: only?.id ?? null,
      supersetConnectedAt: only ? new Date() : null,
    })
    .where(eq(members.id, args.memberId));

  forgetSupersetCredentials();

  return { organizations, chosenOrganizationId: only?.id ?? null };
}

export async function supersetOrganizationsFor(
  member: SelectMember,
): Promise<SupersetOrganization[]> {
  const { jwt, claims } = await jwtFor(member);
  return listOrganizations(jwt, claims.organizationIds);
}

export async function chooseSupersetOrganization(args: {
  member: SelectMember;
  organizationId: string;
}): Promise<void> {
  const { claims } = await jwtFor(args.member);

  if (!claims.organizationIds.includes(args.organizationId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "That Superset organization is not on this key.",
    });
  }

  await db
    .update(members)
    .set({
      supersetOrgId: args.organizationId,
      supersetConnectedAt: new Date(),
    })
    .where(eq(members.id, args.member.id));

  forgetSupersetCredentials();
}

function storedApiKey(member: SelectMember): string | null {
  return member.supersetKeyEncrypted
    ? tryDecryptApiKey(member.supersetKeyEncrypted)
    : null;
}

async function jwtFor(member: SelectMember) {
  const apiKey = storedApiKey(member);
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: member.supersetKeyEncrypted
        ? new UndecryptableKeyError().message
        : "Superset is not connected for this member.",
    });
  }
  const { jwt } = await mintJwt(apiKey);
  return { jwt, claims: decodeJwtClaims(jwt) };
}

async function sessionFor(member: SelectMember) {
  if (!member.supersetOrgId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No Superset organization chosen yet.",
    });
  }
  const { jwt } = await jwtFor(member);
  return { jwt, supersetOrgId: member.supersetOrgId };
}

export async function hostsFor(member: SelectMember): Promise<SupersetHost[]> {
  const { jwt, supersetOrgId } = await sessionFor(member);
  return listHosts(jwt, supersetOrgId);
}

export interface PickableProject extends SupersetProject {
  added: boolean;
}

export interface HostProjects {
  host: SupersetHost;
  projects: PickableProject[];
  error: string | null;
}

export async function projectsForAllHosts(args: {
  member: SelectMember;
  organizationId: string;
}): Promise<HostProjects[]> {
  const { jwt, supersetOrgId } = await sessionFor(args.member);

  const [hosts, existing] = await Promise.all([
    listHosts(jwt, supersetOrgId),
    db.query.projects.findMany({
      where: eq(projects.organizationId, args.organizationId),
      columns: { supersetProjectId: true },
    }),
  ]);

  const added = new Set(existing.map((row) => row.supersetProjectId));

  return Promise.all(
    hosts.map(async (host) => {
      if (!host.online) {
        return { host, projects: [], error: null };
      }
      try {
        const found = await listProjects(jwt, supersetOrgId, host.id);
        return {
          host,
          projects: found.map((project) => ({
            ...project,
            added: added.has(project.id),
          })),
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

export interface SupersetConnection {
  connected: boolean;
  organizationId: string | null;
  organizationName: string | null;
  connectedAt: Date | null;
}

export async function supersetConnectionFor(
  member: SelectMember,
): Promise<SupersetConnection> {
  if (!storedApiKey(member)) {
    return {
      connected: false,
      organizationId: null,
      organizationName: null,
      connectedAt: null,
    };
  }

  const { jwt } = await jwtFor(member);
  const organization = member.supersetOrgId
    ? await getOrganization(jwt, member.supersetOrgId)
    : null;

  return {
    connected: true,
    organizationId: member.supersetOrgId,
    organizationName: organization?.name ?? null,
    connectedAt: member.supersetConnectedAt,
  };
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
  member: SelectMember;
  selected: SelectedProject[];
}): Promise<number> {
  if (args.selected.length === 0) return 0;

  if (!args.member.supersetOrgId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No Superset organization chosen yet.",
    });
  }

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
        supersetOrgId: args.member.supersetOrgId!,
        name: project.name,
        slug,
        repoOwner: project.repoOwner,
        repoName: project.repoName,
        repoUrl: project.repoUrl,
        repoPath: project.repoPath,
        addedByMemberId: args.member.id,
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
