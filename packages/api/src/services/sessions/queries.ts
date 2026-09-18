import {
  db,
  members,
  messages,
  threadSessions,
  threads,
  users,
} from "@roster/db";
import { and, asc, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";

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
  Date | string | null
>`(select max(rp.created_at) from roster.messages rp where ${REPLY_SCOPE})`;

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

const THREAD_ID = sql.raw(`"roster"."threads"."id"`);

const LEAD_ORDER = sql`case ts.status when 'running' then 0 when 'starting' then 1 when 'waiting' then 2 else 3 end, case when ts.role = 'main' then 0 else 1 end, ts.started_at desc`;

function leadSession<T>(column: string): SQL<T> {
  return sql<T>`(select ts.${sql.raw(column)} from roster.thread_sessions ts where ts.thread_id = ${THREAD_ID} order by ${LEAD_ORDER} limit 1)`;
}

const statusSql = leadSession<string>("status");
const lastProgressSql = leadSession<string | null>("last_progress");
const errorSql = leadSession<string | null>("error");
const endedAtSql = leadSession<Date | string | null>("ended_at");

const startedAtSql = sql<
  Date | string | null
>`(select min(ts.started_at) from roster.thread_sessions ts where ts.thread_id = ${THREAD_ID})`;

const sessionState = {
  status: statusSql.as("lead_status"),
  lastProgress: lastProgressSql.as("lead_progress"),
  error: errorSql.as("lead_error"),
  startedAt: startedAtSql.as("lead_started_at"),
  endedAt: endedAtSql.as("lead_ended_at"),
};

const summaryColumns = {
  id: threads.id,
  projectId: threads.projectId,
  rootMessageId: threads.rootMessageId,
  ...sessionState,
  rootText: messages.text,
  authorName: users.name,
  authorEmail: users.email,
  replyCount: replyCountSql,
  lastReplyAt: lastReplyAtSql,
  replierNames: replierNamesSql,
};

function asDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface SummaryRow {
  status: string | null;
  lastProgress: string | null;
  error: string | null;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  rootText: string | null;
  replyCount: number;
  lastReplyAt: Date | string | null;
  replierNames: string[] | null;
}

function toSummary(
  row: SummaryRow,
): Pick<
  ThreadSummary,
  | "status"
  | "lastProgress"
  | "error"
  | "startedAt"
  | "endedAt"
  | "rootText"
  | "replyCount"
  | "lastReplyAt"
  | "replierNames"
> {
  return {
    status: row.status ?? "starting",
    lastProgress: row.lastProgress,
    error: readableError(row.error),
    startedAt: asDate(row.startedAt) ?? new Date(),
    endedAt: asDate(row.endedAt),
    rootText: row.rootText ?? "",
    replyCount: Number(row.replyCount ?? 0),
    lastReplyAt: asDate(row.lastReplyAt),
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
    .orderBy(desc(startedAtSql))
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
  const [row] = await db
    .select({
      id: threads.id,
      organizationId: threads.organizationId,
      projectId: threads.projectId,
      rootMessageId: threads.rootMessageId,
      status: statusSql.as("lead_status"),
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  return row ? { ...row, status: row.status ?? "starting" } : null;
}

export interface ThreadPublishState {
  id: string;
  projectId: string;
  rootMessageId: string;
  status: string;
  lastProgress: string | null;
  error: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

export async function threadPublishState(
  threadId: string,
): Promise<ThreadPublishState | null> {
  const [row] = await db
    .select({
      id: threads.id,
      projectId: threads.projectId,
      rootMessageId: threads.rootMessageId,
      ...sessionState,
    })
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    projectId: row.projectId,
    rootMessageId: row.rootMessageId,
    status: row.status ?? "starting",
    lastProgress: row.lastProgress,
    error: readableError(row.error),
    startedAt: asDate(row.startedAt) ?? new Date(),
    endedAt: asDate(row.endedAt),
  };
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
      status: threadSessions.status,
    })
    .from(threads)
    .innerJoin(messages, eq(threads.rootMessageId, messages.id))
    .innerJoin(
      threadSessions,
      and(
        eq(threadSessions.threadId, threads.id),
        eq(threadSessions.role, "main"),
      ),
    )
    .where(
      and(
        eq(threads.projectId, args.projectId),
        inArray(threadSessions.status, ["starting", "running"]),
        gte(threadSessions.startedAt, args.since),
        eq(messages.authorMemberId, args.authorMemberId),
      ),
    )
    .orderBy(desc(threadSessions.startedAt))
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
    .where(
      and(eq(threads.id, args.threadId), eq(threads.projectId, args.projectId)),
    )
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
