import { db, members, messages, threads, users } from "@roster/db";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { readableError } from "../../utils/session-error";
import {
  AGENT_IDENTITY_ON,
  agentChannel,
  agentOwner,
  type ChannelMessage,
  messageColumns,
  toChannelMessage,
} from "../message-columns";

export interface ThreadSummary {
  id: string;
  projectId: string;
  rootMessageId: string;
  status: string;
  lastProgress: string | null;
  error: string | null;
  startedAt: Date;
  endedAt: Date | null;
  rootText: string;
  authorName: string | null;
  authorEmail: string | null;
  replyCount: number;
  lastReplyAt: Date | null;
  replierNames: string[];
}

const REPLY_SCOPE = sql`rp.thread_id = ${threads.id} and rp.id <> ${threads.rootMessageId} and rp.deleted_at is null`;

const replyCountSql = sql<number>`(select count(*)::int from roster.messages rp where ${REPLY_SCOPE})`;

const lastReplyAtSql = sql<
  string | null
>`(select to_char(max(rp.created_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from roster.messages rp where ${REPLY_SCOPE})`;

/**
 * Mirrors `agentDisplay` for agent replies, which carry no author: a thread
 * that fern [core] answered should say so rather than "Agent". Kept in SQL so
 * the aggregate stays a single subquery.
 */
const replierNamesSql = sql<string[]>`(select coalesce(json_agg(distinct coalesce(
  nullif(btrim(ru.name), ''),
  ru.email,
  case when ap.slug is not null
    then coalesce(nullif(btrim(lower(am.agent_name)), ''), 'agent') || ' [' || ap.slug || ']'
  end,
  'Agent'
)), '[]'::json) from roster.messages rp
  left join auth.members rm on rm.id = rp.author_member_id
  left join auth.users ru on ru.id = rm.user_id
  left join roster.projects ap on ap.id = rp.agent_channel_id
  left join auth.members am on am.id = ap.added_by_member_id
  where ${REPLY_SCOPE})`;

const summaryColumns = {
  id: threads.id,
  projectId: threads.projectId,
  rootMessageId: threads.rootMessageId,
  status: threads.status,
  lastProgress: threads.lastProgress,
  error: threads.error,
  startedAt: threads.startedAt,
  endedAt: threads.endedAt,
  rootText: messages.text,
  authorName: users.name,
  authorEmail: users.email,
  replyCount: replyCountSql,
  lastReplyAt: lastReplyAtSql,
  replierNames: replierNamesSql,
};

function toSummary(row: {
  rootText: string | null;
  error: string | null;
  replyCount: number;
  lastReplyAt: Date | string | null;
  replierNames: string[] | null;
}): Pick<
  ThreadSummary,
  "rootText" | "error" | "replyCount" | "lastReplyAt" | "replierNames"
> {
  const lastReplyAt =
    row.lastReplyAt === null ? null : new Date(row.lastReplyAt);
  return {
    rootText: row.rootText ?? "",
    error: readableError(row.error),
    replyCount: Number(row.replyCount ?? 0),
    lastReplyAt:
      lastReplyAt && !Number.isNaN(lastReplyAt.getTime()) ? lastReplyAt : null,
    replierNames: row.replierNames ?? [],
  };
}

export async function listChannelThreads(
  projectId: string,
): Promise<ThreadSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(threads)
    .leftJoin(messages, eq(threads.rootMessageId, messages.id))
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
    .where(eq(threads.projectId, projectId))
    .orderBy(desc(threads.startedAt))
    .limit(100);

  return rows.map((row) => ({ ...row, ...toSummary(row) }));
}

export async function threadProjectId(
  threadId: string,
): Promise<string | null> {
  const row = await db.query.threads.findFirst({
    where: eq(threads.id, threadId),
    columns: { projectId: true },
  });
  return row?.projectId ?? null;
}

export interface ThreadTarget {
  id: string;
  organizationId: string;
  projectId: string;
  rootMessageId: string;
  status: string;
}

export async function threadTarget(
  threadId: string,
): Promise<ThreadTarget | null> {
  const row = await db.query.threads.findFirst({
    where: eq(threads.id, threadId),
    columns: {
      id: true,
      organizationId: true,
      projectId: true,
      rootMessageId: true,
      status: true,
    },
  });
  return row ?? null;
}

export async function joinableThread(args: {
  projectId: string;
  authorMemberId: string;
  since: Date;
}): Promise<ThreadTarget | null> {
  const [row] = await db
    .select({
      id: threads.id,
      organizationId: threads.organizationId,
      projectId: threads.projectId,
      rootMessageId: threads.rootMessageId,
      status: threads.status,
    })
    .from(threads)
    .innerJoin(messages, eq(threads.rootMessageId, messages.id))
    .where(
      and(
        eq(threads.projectId, args.projectId),
        inArray(threads.status, ["starting", "running"]),
        gte(threads.startedAt, args.since),
        eq(messages.authorMemberId, args.authorMemberId),
      ),
    )
    .orderBy(desc(threads.startedAt))
    .limit(1);

  return row ?? null;
}

export interface ThreadDetail {
  thread: ThreadSummary;
  messages: ChannelMessage[];
}

export async function threadSummary(args: {
  projectId: string;
  threadId: string;
}): Promise<ThreadSummary | null> {
  const [row] = await db
    .select(summaryColumns)
    .from(threads)
    .leftJoin(messages, eq(threads.rootMessageId, messages.id))
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
    .where(and(eq(threads.id, args.threadId), eq(threads.projectId, args.projectId)))
    .limit(1);

  return row ? { ...row, ...toSummary(row) } : null;
}

export async function threadDetail(args: {
  projectId: string;
  threadId: string;
}): Promise<ThreadDetail | null> {
  const thread = await threadSummary(args);
  if (!thread) return null;

  const rows = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
    .leftJoin(agentChannel, AGENT_IDENTITY_ON.channel)
    .leftJoin(agentOwner, AGENT_IDENTITY_ON.owner)
    .where(eq(messages.threadId, args.threadId))
    .orderBy(asc(messages.seq));

  return { thread, messages: rows.map(toChannelMessage) };
}
