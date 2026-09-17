import { channelStars, db, projects } from "@roster/db";
import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";

export interface Channel {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  starred: boolean;
  repoOwner: string | null;
  repoName: string | null;
  repoPath: string | null;
}

export interface ChannelGroups {
  starred: Channel[];
  public: Channel[];
  private: Channel[];
}

export interface ChannelScope {
  organizationId: string;
  memberId: string;
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
    })
    .from(projects)
    .leftJoin(
      channelStars,
      and(
        eq(channelStars.projectId, projects.id),
        eq(channelStars.memberId, scope.memberId),
      ),
    )
    .where(
      and(
        eq(projects.organizationId, scope.organizationId),
        or(
          eq(projects.visibility, "public"),
          and(
            eq(projects.visibility, "private"),
            eq(projects.addedByMemberId, scope.memberId),
          ),
        ),
      ),
    )
    .orderBy(asc(projects.slug));

  const groups: ChannelGroups = { starred: [], public: [], private: [] };

  for (const row of rows) {
    const channel: Channel = { ...row, starred: Boolean(row.starred) };
    if (channel.starred) groups.starred.push(channel);
    else if (channel.visibility === "private") groups.private.push(channel);
    else groups.public.push(channel);
  }

  return groups;
}

function visibleToMember(memberId: string) {
  return or(
    eq(projects.visibility, "public"),
    and(
      eq(projects.visibility, "private"),
      eq(projects.addedByMemberId, memberId),
    ),
  );
}

export async function getChannelBySlug(args: {
  organizationId: string;
  memberId: string;
  slug: string;
}) {
  const channel = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, args.organizationId),
      eq(projects.slug, args.slug),
      visibleToMember(args.memberId),
    ),
  });
  return channel ?? null;
}

export async function requireOrgProject(args: {
  organizationId: string;
  memberId: string;
  projectId: string;
}) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, args.projectId),
      eq(projects.organizationId, args.organizationId),
      visibleToMember(args.memberId),
    ),
  });
  return project ?? null;
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
