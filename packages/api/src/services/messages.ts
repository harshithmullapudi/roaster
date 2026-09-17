import { db, members, messages, projects, threads, users } from "@roster/db";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";

import { contiguousRun, type RunMessage } from "../utils/message-run";
import {
  AGENT_IDENTITY_ON,
  agentChannel,
  agentOwner,
  type ChannelMessage,
  messageColumns,
  toChannelMessage,
} from "./message-columns";
import { allocateSeq } from "./channels";
import { channelName, publish } from "./centrifugo";
import {
  createThread,
  ensureStarted,
  joinableThread,
  startSession,
  steer,
  threadChannelName,
  threadTarget,
} from "./sessions";

const JOIN_WINDOW_MS = 10_000;
const RUN_LOOKBACK = 20;

export type { ChannelMessage } from "./message-columns";

export async function listMessages(args: {
  projectId: string;
  before?: number;
  limit?: number;
}): Promise<ChannelMessage[]> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

  const conditions = [
    eq(messages.projectId, args.projectId),
    isNull(messages.deletedAt),
    isNull(messages.parentMessageId),
  ];
  if (args.before !== undefined) conditions.push(lt(messages.seq, args.before));

  const rows = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
    .leftJoin(agentChannel, AGENT_IDENTITY_ON.channel)
    .leftJoin(agentOwner, AGENT_IDENTITY_ON.owner)
    .where(and(...conditions))
    .orderBy(desc(messages.seq))
    .limit(limit);

  return rows.reverse().map(toChannelMessage);
}

async function findByClientId(args: {
  projectId: string;
  clientId: string;
}): Promise<ChannelMessage | null> {
  const [row] = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
    .leftJoin(agentChannel, AGENT_IDENTITY_ON.channel)
    .leftJoin(agentOwner, AGENT_IDENTITY_ON.owner)
    .where(
      and(
        eq(messages.projectId, args.projectId),
        eq(messages.clientId, args.clientId),
      ),
    )
    .orderBy(asc(messages.seq))
    .limit(1);

  return row ? toChannelMessage(row) : null;
}

async function findById(id: string): Promise<ChannelMessage> {
  const [row] = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
    .leftJoin(agentChannel, AGENT_IDENTITY_ON.channel)
    .leftJoin(agentOwner, AGENT_IDENTITY_ON.owner)
    .where(eq(messages.id, id))
    .limit(1);

  if (!row) throw new Error("Message not found.");
  return toChannelMessage(row);
}

export async function publishMessage(
  message: ChannelMessage,
): Promise<void> {
  const payload = {
    type: "message" as const,
    message: {
      ...message,
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt ? message.editedAt.toISOString() : null,
    },
  };

  const targets = [publish(channelName(message.projectId), payload)];
  if (message.threadId && message.parentMessageId) {
    targets.push(publish(threadChannelName(message.threadId), payload));
  }

  await Promise.all(targets);
}

export async function sendMessage(args: {
  organizationId: string;
  projectId: string;
  authorMemberId: string;
  body: unknown;
  text: string;
  clientId: string;
  threadId?: string;
}): Promise<ChannelMessage> {
  const existing = await findByClientId({
    projectId: args.projectId,
    clientId: args.clientId,
  });
  if (existing) return existing;

  const explicit = args.threadId ? await threadTarget(args.threadId) : null;
  if (args.threadId && (!explicit || explicit.projectId !== args.projectId)) {
    throw new Error("That thread is not part of this channel.");
  }

  const watching = await channelIsWatching(args.projectId);
  const target =
    explicit ??
    (watching
      ? await joinableThread({
          projectId: args.projectId,
          authorMemberId: args.authorMemberId,
          since: new Date(Date.now() - JOIN_WINDOW_MS),
        })
      : null);

  const seq = await allocateSeq(args.projectId);

  const inserted = await db
    .insert(messages)
    .values({
      organizationId: args.organizationId,
      projectId: args.projectId,
      seq,
      authorMemberId: args.authorMemberId,
      kind: "user",
      body: args.body,
      text: args.text,
      clientId: args.clientId,
      threadId: target ? target.id : null,
      parentMessageId: target ? target.rootMessageId : null,
    })
    .onConflictDoNothing({
      target: [messages.projectId, messages.clientId],
    })
    .returning({ id: messages.id });

  const row = inserted[0]
    ? await findById(inserted[0].id)
    : await findByClientId({
        projectId: args.projectId,
        clientId: args.clientId,
      });

  if (!row) throw new Error("Message could not be stored.");

  await publishMessage(row);

  if (row.kind !== "user") return row;

  if (target) {
    void steer({ threadId: target.id, text: row.text }).catch(() => {});
  } else if (row.parentMessageId === null && watching) {
    void driveSession(row).catch(() => {});
  }

  return row;
}

async function channelIsWatching(projectId: string): Promise<boolean> {
  const row = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { watchEnabled: true },
  });
  return row?.watchEnabled ?? false;
}

async function contextFor(message: ChannelMessage): Promise<string[]> {
  const earlier = await db
    .select({
      id: messages.id,
      authorMemberId: messages.authorMemberId,
      createdAt: messages.createdAt,
      threadId: messages.threadId,
      text: messages.text,
    })
    .from(messages)
    .where(
      and(
        eq(messages.projectId, message.projectId),
        eq(messages.kind, "user"),
        isNull(messages.parentMessageId),
        isNull(messages.deletedAt),
        lt(messages.seq, message.seq),
      ),
    )
    .orderBy(desc(messages.seq))
    .limit(RUN_LOOKBACK);

  const newest: RunMessage = {
    id: message.id,
    authorMemberId: message.authorMemberId,
    createdAt: message.createdAt,
    threadId: null,
    text: message.text,
  };

  const run = contiguousRun({ newest, earlier });
  return run.slice(0, -1).map((entry) => entry.text);
}

async function driveSession(message: ChannelMessage): Promise<void> {
  await ensureStarted();

  const [project] = await db
    .select({ organizationId: messages.organizationId })
    .from(messages)
    .where(eq(messages.id, message.id))
    .limit(1);
  if (!project) return;

  const context = await contextFor(message);

  const thread = await createThread({
    organizationId: project.organizationId,
    projectId: message.projectId,
    rootMessageId: message.id,
  });
  if (!thread) return;

  await startSession({ threadId: thread.id, text: message.text, context });
}

export async function pausedMessageCount(projectId: string): Promise<number> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { watchPausedAt: true },
  });
  if (!project?.watchPausedAt) return 0;

  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.projectId, projectId),
        eq(messages.kind, "user"),
        isNull(messages.parentMessageId),
        isNull(messages.threadId),
        isNull(messages.deletedAt),
        gte(messages.createdAt, project.watchPausedAt),
      ),
    );

  return rows.length;
}

export async function startPausedSession(
  projectId: string,
): Promise<ChannelMessage | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { watchPausedAt: true },
  });

  const since = project?.watchPausedAt ?? null;
  await db
    .update(projects)
    .set({ watchEnabled: true, watchPausedAt: null })
    .where(eq(projects.id, projectId));

  if (!since) return null;

  const [newest] = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
    .leftJoin(agentChannel, AGENT_IDENTITY_ON.channel)
    .leftJoin(agentOwner, AGENT_IDENTITY_ON.owner)
    .where(
      and(
        eq(messages.projectId, projectId),
        eq(messages.kind, "user"),
        isNull(messages.parentMessageId),
        isNull(messages.threadId),
        isNull(messages.deletedAt),
        gte(messages.createdAt, since),
      ),
    )
    .orderBy(desc(messages.seq))
    .limit(1);

  if (!newest) return null;

  const row = toChannelMessage(newest);
  void driveSession(row).catch(() => {});
  return row;
}

export async function threadIdForMessage(
  messageId: string,
): Promise<string | null> {
  const row = await db.query.threads.findFirst({
    where: eq(threads.rootMessageId, messageId),
    columns: { id: true },
  });
  return row?.id ?? null;
}
