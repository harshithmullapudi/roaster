import { channelStars, db, members, projects, users } from "@roster/db";
import { and, asc, eq, isNotNull, ne, or, sql } from "drizzle-orm";

import { can } from "../lib/access";
import { agentDisplay, agentHandle } from "../lib/agent-identity";
import type { ChannelVisibility } from "../lib/channel-visibility";

export interface Channel {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  starred: boolean;
  repoOwner: string | null;
  repoName: string | null;
  repoPath: string | null;
  agentName: string;
  agentHandle: string;
  agentDisplay: string;
}

export interface ChannelGroups {
  starred: Channel[];
  public: Channel[];
  private: Channel[];
}

export interface ChannelScope {
  organizationId: string;
  memberId: string;
  role: string;
}

export async function listChannels(scope: ChannelScope): Promise<ChannelGroups> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      visibility: projects.visibility,
      repoOwner: projects.repoOwner,
      repoName: projects.repoName,
      repoPath: projects.repoPath,
      starred: isNotNull(channelStars.id),
      ownerAgentName: members.agentName,
    })
    .from(projects)
    .leftJoin(
      channelStars,
      and(
        eq(channelStars.projectId, projects.id),
        eq(channelStars.memberId, scope.memberId),
      ),
    )
    .leftJoin(members, eq(projects.addedByMemberId, members.id))
    .where(
      and(
        eq(projects.organizationId, scope.organizationId),
        visibleToMember(scope.memberId, scope.role),
      ),
    )
    .orderBy(asc(projects.slug));

  const groups: ChannelGroups = { starred: [], public: [], private: [] };

  for (const row of rows) {
    const { ownerAgentName, ...rest } = row;
    const channel: Channel = {
      ...rest,
      starred: Boolean(row.starred),
      ...toAgent(ownerAgentName, row.slug),
    };
    if (channel.starred) groups.starred.push(channel);
    else if (channel.visibility === "private") groups.private.push(channel);
    else groups.public.push(channel);
  }

  return groups;
}

function toAgent(
  agentName: string | null,
  slug: string,
): Pick<Channel, "agentName" | "agentHandle" | "agentDisplay"> {
  return {
    agentName: agentName ?? "",
    agentHandle: agentHandle(agentName, slug),
    agentDisplay: agentDisplay(agentName, slug),
  };
}

export async function listMentionableChannels(
  scope: ChannelScope,
): Promise<Channel[]> {
  const groups = await listChannels(scope);
  return [...groups.starred, ...groups.public, ...groups.private].sort((a, b) =>
    a.agentHandle.localeCompare(b.agentHandle),
  );
}

export interface MentionableMember {
  id: string;
  handle: string;
  name: string;
}

export async function listMentionableMembers(
  scope: ChannelScope,
): Promise<MentionableMember[]> {
  const rows = await db
    .select({
      id: members.id,
      agentName: members.agentName,
      name: users.name,
      email: users.email,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(
      and(
        eq(members.organizationId, scope.organizationId),
        isNotNull(members.agentName),
        ne(members.id, scope.memberId),
      ),
    );

  return rows
    .flatMap((row) => {
      const handle = (row.agentName ?? "").trim().toLowerCase();
      if (handle.length === 0) return [];
      const name = row.name.trim();
      return [
        {
          id: row.id,
          handle,
          name: name.length > 0 ? name : row.email,
        },
      ];
    })
    .sort((a, b) => a.handle.localeCompare(b.handle));
}

export async function findMemberByHandle(args: {
  organizationId: string;
  handle: string;
}): Promise<MentionableMember | null> {
  const wanted = args.handle.trim().toLowerCase().replace(/^@/, "");
  if (wanted.length === 0) return null;

  const [row] = await db
    .select({
      id: members.id,
      agentName: members.agentName,
      name: users.name,
      email: users.email,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(
      and(
        eq(members.organizationId, args.organizationId),
        eq(sql`lower(${members.agentName})`, wanted),
      ),
    )
    .limit(1);

  if (!row) return null;

  const name = row.name.trim();
  return {
    id: row.id,
    handle: (row.agentName ?? "").toLowerCase(),
    name: name.length > 0 ? name : row.email,
  };
}

export async function resolveAgentHandle(
  scope: ChannelScope,
  handle: string,
): Promise<Channel | null> {
  const wanted = handle.trim().toLowerCase().replace(/^@/, "");
  if (wanted.length === 0) return null;

  const channels = await listMentionableChannels(scope);
  return channels.find((channel) => channel.agentHandle === wanted) ?? null;
}

export async function channelAgentIdentity(projectId: string) {
  const [row] = await db
    .select({ slug: projects.slug, agentName: members.agentName })
    .from(projects)
    .leftJoin(members, eq(projects.addedByMemberId, members.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!row) return null;

  return {
    channelSlug: row.slug,
    ...toAgent(row.agentName, row.slug),
  };
}

export function visibleToMember(memberId: string, role: string) {
  if (can(role, "channel:update")) return undefined;

  return or(
    eq(projects.visibility, "public"),
    and(
      eq(projects.visibility, "private"),
      eq(projects.addedByMemberId, memberId),
    ),
  );
}

export async function getChannelBySlug(args: ChannelScope & { slug: string }) {
  const channel = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, args.organizationId),
      eq(projects.slug, args.slug),
      visibleToMember(args.memberId, args.role),
    ),
  });
  return channel ?? null;
}

export async function requireOrgProject(
  args: ChannelScope & { projectId: string },
) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, args.projectId),
      eq(projects.organizationId, args.organizationId),
      visibleToMember(args.memberId, args.role),
    ),
  });
  return project ?? null;
}

export interface ChannelPatch {
  visibility?: ChannelVisibility;
}

export async function updateChannel(
  args: ChannelScope & { projectId: string; patch: ChannelPatch },
) {
  const project = await requireOrgProject(args);
  if (!project) return null;

  const patch = Object.fromEntries(
    Object.entries(args.patch).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(patch).length === 0) return project;

  const [updated] = await db
    .update(projects)
    .set(patch)
    .where(eq(projects.id, project.id))
    .returning();

  return updated ?? null;
}

export interface ChannelWatch {
  projectId: string;
  watchEnabled: boolean;
  watchPausedAt: Date | null;
}

export async function setChannelWatch(args: {
  projectId: string;
  enabled: boolean;
}): Promise<ChannelWatch | null> {
  const [row] = await db
    .update(projects)
    .set(
      args.enabled
        ? { watchEnabled: true }
        : { watchEnabled: false, watchPausedAt: new Date() },
    )
    .where(eq(projects.id, args.projectId))
    .returning();

  if (!row) return null;
  return {
    projectId: row.id,
    watchEnabled: row.watchEnabled,
    watchPausedAt: row.watchPausedAt,
  };
}

export async function dismissChannelPause(
  projectId: string,
): Promise<ChannelWatch | null> {
  const [row] = await db
    .update(projects)
    .set({ watchPausedAt: null })
    .where(eq(projects.id, projectId))
    .returning();

  if (!row) return null;
  return {
    projectId: row.id,
    watchEnabled: row.watchEnabled,
    watchPausedAt: row.watchPausedAt,
  };
}

export async function toggleChannelStar(args: {
  memberId: string;
  projectId: string;
}) {
  const existing = await db.query.channelStars.findFirst({
    where: and(
      eq(channelStars.memberId, args.memberId),
      eq(channelStars.projectId, args.projectId),
    ),
  });

  if (existing) {
    await db.delete(channelStars).where(eq(channelStars.id, existing.id));
    return { projectId: args.projectId, starred: false };
  }

  await db
    .insert(channelStars)
    .values({ memberId: args.memberId, projectId: args.projectId })
    .onConflictDoNothing({
      target: [channelStars.memberId, channelStars.projectId],
    });

  return { projectId: args.projectId, starred: true };
}

export async function allocateSeq(projectId: string): Promise<number> {
  const [row] = await db
    .update(projects)
    .set({ lastSeq: sql`${projects.lastSeq} + 1` })
    .where(eq(projects.id, projectId))
    .returning({ lastSeq: projects.lastSeq });

  if (!row) throw new Error("Channel not found.");
  return Number(row.lastSeq);
}
