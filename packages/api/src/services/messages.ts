import {
  db,
  delegations,
  members,
  messages,
  projects,
  threads,
  users,
} from "@roster/db";
import { and, asc, desc, eq, gte, isNull, lt, ne, or } from "drizzle-orm";

import { type DeleteRefusal, deleteRefusal } from "../lib/message-delete";
import { DELEGATION_KIND } from "../lib/message-kind";
import { mentionedHandles } from "../lib/message-mentions";
import { sessionErrorDetail } from "../utils/session-error";
import { contiguousRun, type RunMessage } from "../utils/message-run";
import {
  AGENT_IDENTITY_ON,
  agentChannel,
  agentOwner,
  type ChannelMessage,
  messageColumns,
  toChannelMessage,
} from "./message-columns";
import { allocateSeq, listMentionableChannels } from "./channels";
import { channelName, publish } from "./centrifugo";
import {
  cancelThread,
  createThread,
  ensureStarted,
  joinableThread,
  reapThread,
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
    ne(messages.kind, DELEGATION_KIND),
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

export async function messageById(id: string): Promise<ChannelMessage> {
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

export interface MessageDeletion {
  messageId: string;
  projectId: string;
  threadId: string | null;
}

export type DeleteResult =
  | { refusal: DeleteRefusal }
  | { deleted: MessageDeletion };

async function publishDeletion(deletion: MessageDeletion): Promise<void> {
  const payload = {
    type: "message-deleted" as const,
    messageId: deletion.messageId,
    threadId: deletion.threadId,
    projectId: deletion.projectId,
  };

  const targets = [publish(channelName(deletion.projectId), payload)];
  if (deletion.threadId) {
    targets.push(publish(threadChannelName(deletion.threadId), payload));
  }

  await Promise.all(targets);
}

async function openDelegationChildren(parentThreadId: string): Promise<string[]> {
  const rows = await db
    .select({ childThreadId: delegations.childThreadId })
    .from(delegations)
    .where(
      and(
        eq(delegations.parentThreadId, parentThreadId),
        eq(delegations.status, "open"),
      ),
    );

  return rows
    .map((row) => row.childThreadId)
    .filter((id): id is string => id !== null);
}

export async function deleteMessage(args: {
  projectId: string;
  messageId: string;
  memberId: string;
}): Promise<DeleteResult> {
  const row = await db.query.messages.findFirst({
    where: and(
      eq(messages.id, args.messageId),
      eq(messages.projectId, args.projectId),
    ),
    columns: { kind: true, authorMemberId: true, deletedAt: true },
  });

  const refusal = deleteRefusal(row ?? null, args.memberId);
  if (refusal) return { refusal };

  const thread = await db.query.threads.findFirst({
    where: eq(threads.rootMessageId, args.messageId),
    columns: { id: true },
  });

  if (thread) {
    const children = await openDelegationChildren(thread.id);
    for (const threadId of [thread.id, ...children]) {
      await stopAndReap(threadId);
    }
  }

  await db
    .update(messages)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(messages.projectId, args.projectId),
        isNull(messages.deletedAt),
        thread
          ? or(
              eq(messages.id, args.messageId),
              eq(messages.threadId, thread.id),
            )
          : eq(messages.id, args.messageId),
      ),
    );

  if (thread) {
    await db.delete(threads).where(eq(threads.id, thread.id));
  }

  const deletion: MessageDeletion = {
    messageId: args.messageId,
    projectId: args.projectId,
    threadId: thread?.id ?? null,
  };
  await publishDeletion(deletion);

  return { deleted: deletion };
}

async function stopAndReap(threadId: string): Promise<void> {
  try {
    await cancelThread({ threadId });
  } catch (cause) {
    console.warn(
      `[messages] cancel before delete failed for ${threadId}: ${sessionErrorDetail(cause)}`,
    );
  }

  try {
    await reapThread({ threadId });
  } catch (cause) {
    console.warn(
      `[messages] reap before delete failed for ${threadId}: ${sessionErrorDetail(cause)}`,
    );
  }
}

export async function sendMessage(args: {
  organizationId: string;
  projectId: string;
  authorMemberId: string;
  role: string;
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

  /**
   * Watch governs ambient chatter — whether the agent reacts to messages it
   * was not addressed in. Being named is not ambient, so a mention outranks a
   * pause and wakes the channel's own agent, which then delegates onward to
   * any other agent the message named.
   */
  const addressed = (await channelIsWatching(args.projectId))
    ? true
    : await mentionsAnyAgent(args);

  const target =
    explicit ??
    (addressed
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
    ? await messageById(inserted[0].id)
    : await findByClientId({
        projectId: args.projectId,
        clientId: args.clientId,
      });

  if (!row) throw new Error("Message could not be stored.");

  await publishMessage(row);

  if (row.kind !== "user") return row;

  if (target) {
    void steer({ threadId: target.id, text: row.text }).catch(() => {});
  } else if (row.parentMessageId === null && addressed) {
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

/**
 * Whether the message names an agent. Only consulted for a paused channel — a
 * watching one already answers everything — so the channel list this costs is
 * read once per message sent into silence, not on the common path.
 *
 * Scoped to the author's visible channels so a handle they could not have
 * picked from the autocomplete cannot be typed out to the same effect.
 */
async function mentionsAnyAgent(args: {
  organizationId: string;
  authorMemberId: string;
  role: string;
  body: unknown;
  text: string;
}): Promise<boolean> {
  const channels = await listMentionableChannels({
    organizationId: args.organizationId,
    memberId: args.authorMemberId,
    role: args.role,
  });

  const mentioned = mentionedHandles({
    body: args.body,
    text: args.text,
    known: channels.map((channel) => channel.agentHandle),
  });

  return mentioned.length > 0;
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
    runAsMemberId: message.authorMemberId,
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
