import { createHash } from "node:crypto";

import {
  db,
  delegations,
  messages,
  projects,
  type SelectDelegation,
  threads,
} from "@roster/db";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";

import { DELEGATION_KIND } from "../lib/message-kind";
import {
  allocateSeq,
  channelAgentIdentity,
  findMemberByHandle,
  listMentionableChannels,
  resolveAgentHandle,
} from "./channels";
import type { ChannelScope } from "./channels";
import { emitMessageById } from "./message-events";
import { notifyDelegationReceived } from "./notifications";
import {
  createThread,
  ensureStarted,
  markWaiting,
  startSession,
  steer,
} from "./sessions";
import { markdownToTiptap, textToTiptap } from "../utils/tiptap";

export const MAX_DEPTH = 3;

export interface DelegationRequest extends ChannelScope {
  parentThreadId: string;
  handle: string;
  task: string;
}

export interface DelegationResult {
  id: string;
  targetHandle: string;
  targetChannelId: string;
  childThreadId: string;
  depth: number;
}

async function rejectPersonHandle(args: ChannelScope & { handle: string }) {
  const person = await findMemberByHandle({
    organizationId: args.organizationId,
    handle: args.handle,
  });
  if (!person) return;

  const channels = await listMentionableChannels(args);
  const theirs = channels.find(
    (channel) => channel.agentName.toLowerCase() === person.handle,
  );

  const instead = theirs
    ? `Their agent is \`${theirs.agentHandle}\` — ask that instead.`
    : "They have no agent of their own yet; run `roster channels` to see who you can ask.";

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `"@${person.handle}" is ${person.name}, a person — not a channel. \`roster ask\` only reaches agents. ${instead}`,
  });
}

export async function delegate(
  args: DelegationRequest,
): Promise<DelegationResult> {
  await ensureStarted();

  const parent = await db.query.threads.findFirst({
    where: eq(threads.id, args.parentThreadId),
  });
  if (!parent || parent.organizationId !== args.organizationId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That thread is not one of this team's.",
    });
  }

  const open = await db.query.delegations.findFirst({
    where: and(
      eq(delegations.parentThreadId, parent.id),
      eq(delegations.status, "open"),
    ),
  });
  if (open) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "This thread is already waiting on an answer. Wait for it before asking again.",
    });
  }

  const target = await resolveAgentHandle(args, args.handle);
  if (!target) {
    await rejectPersonHandle(args);
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `No agent called "${args.handle}". Run \`roster channels\` to see who you can ask.`,
    });
  }

  if (target.id === parent.projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That is this channel's own agent — just do the work.",
    });
  }

  const depth = (await ancestorDepth(parent.id)) + 1;
  if (depth > MAX_DEPTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Requests can only be passed along ${MAX_DEPTH} times. Answer with what you have.`,
    });
  }

  const chain = await ancestorChannels(parent.id);
  if (chain.includes(target.id)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "That agent is already waiting further up this chain — asking it back would deadlock.",
    });
  }

  const task = args.task.trim();
  if (task.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Say what you want done.",
    });
  }

  const asker = await channelAgentIdentity(parent.projectId);

  const rootMessageId = await postRequest({
    organizationId: args.organizationId,
    targetChannelId: target.id,
    askerHandle: asker?.agentHandle ?? "an agent",
    agentChannelId: parent.projectId,
    task,
    dedupeKey: `delegation-request:${parent.id}:${createHash("sha256")
      .update(task)
      .digest("base64url")
      .slice(0, 22)}`,
  });

  const childThread = await createThread({
    organizationId: args.organizationId,
    projectId: target.id,
    rootMessageId,
    runAsMemberId: await channelOwner(target.id),
  });
  if (!childThread) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "This thread is already waiting on an answer. Wait for it before asking again.",
    });
  }

  const [row] = await db
    .insert(delegations)
    .values({
      organizationId: args.organizationId,
      parentThreadId: parent.id,
      originChannelId: parent.projectId,
      targetChannelId: target.id,
      childThreadId: childThread.id,
      task,
      depth,
    })
    .returning();

  if (!row) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This thread is already waiting on an answer.",
    });
  }

  await notifyDelegationReceived({
    childThreadId: childThread.id,
    originChannelId: parent.projectId,
    delegationId: row.id,
    task,
  });

  await markWaiting({ threadId: parent.id, waitingOn: target.agentHandle });

  await startSession({
    threadId: childThread.id,
    text: task,
    delegation: {
      askedBy: asker?.agentHandle ?? "an agent",
      originChannelId: parent.projectId,
    },
  });

  return {
    id: row.id,
    targetHandle: target.agentHandle,
    targetChannelId: target.id,
    childThreadId: childThread.id,
    depth,
  };
}

async function channelOwner(projectId: string): Promise<string> {
  const [row] = await db
    .select({ memberId: projects.addedByMemberId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "That channel is no longer linked to a project.",
    });
  }

  return row.memberId;
}

async function postRequest(args: {
  organizationId: string;
  targetChannelId: string;
  askerHandle: string;
  agentChannelId: string;
  task: string;
  dedupeKey: string;
}): Promise<string> {
  const text = `@${args.askerHandle} asked: ${args.task}`;
  const seq = await allocateSeq(args.targetChannelId);

  const [row] = await db
    .insert(messages)
    .values({
      organizationId: args.organizationId,
      projectId: args.targetChannelId,
      seq,
      authorMemberId: null,
      kind: DELEGATION_KIND,
      agentChannelId: args.agentChannelId,
      body: textToTiptap(text),
      text,
      clientId: args.dedupeKey,
    })
    .onConflictDoNothing({ target: [messages.projectId, messages.clientId] })
    .returning();

  if (row) return row.id;

  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.projectId, args.targetChannelId),
        eq(messages.clientId, args.dedupeKey),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Could not post the request.");

  return existing.id;
}

async function ancestorDepth(threadId: string): Promise<number> {
  let depth = 0;
  let current: string | null = threadId;

  for (let hop = 0; hop < MAX_DEPTH + 1 && current; hop += 1) {
    const row: SelectDelegation | undefined =
      await db.query.delegations.findFirst({
        where: eq(delegations.childThreadId, current),
      });
    if (!row) break;
    depth = Math.max(depth, row.depth);
    current = row.parentThreadId;
  }

  return depth;
}

async function ancestorChannels(threadId: string): Promise<string[]> {
  const chain: string[] = [];
  let current: string | null = threadId;

  for (let hop = 0; hop < MAX_DEPTH + 1 && current; hop += 1) {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, current),
      columns: { projectId: true },
    });
    if (thread) chain.push(thread.projectId);

    const row: SelectDelegation | undefined =
      await db.query.delegations.findFirst({
        where: eq(delegations.childThreadId, current),
      });
    if (!row) break;
    current = row.parentThreadId;
  }

  return chain;
}

export async function settleDelegationFor(args: {
  childThreadId: string;
  reply: string;
  failed?: boolean;
}): Promise<void> {
  const [row] = await db
    .update(delegations)
    .set({
      status: args.failed ? "failed" : "answered",
      answeredAt: new Date(),
    })
    .where(
      and(
        eq(delegations.childThreadId, args.childThreadId),
        eq(delegations.status, "open"),
      ),
    )
    .returning();
  if (!row) return;

  const answering = await channelAgentIdentity(row.targetChannelId);
  const handle = answering?.agentHandle ?? "the other agent";

  const reply = args.reply.trim();
  const spoken = args.failed
    ? `I asked @${handle} but that session ended without an answer.`
    : reply;

  const parent = await db.query.threads.findFirst({
    where: eq(threads.id, row.parentThreadId),
  });
  if (!parent) return;

  await writeReplyIntoParent({
    delegationId: row.id,
    thread: parent,
    text: spoken.length > 0 ? spoken : `@${handle} finished without a reply.`,
    agentChannelId: row.targetChannelId,
  });

  await steer({
    threadId: row.parentThreadId,
    text: args.failed
      ? `@${handle} could not complete that. Decide what to do next.`
      : `@${handle} replied:\n\n${reply}`,
  });
}

async function writeReplyIntoParent(args: {
  delegationId: string;
  thread: { id: string; organizationId: string; projectId: string; rootMessageId: string };
  text: string;
  agentChannelId: string;
}): Promise<void> {
  const seq = await allocateSeq(args.thread.projectId);

  const [row] = await db
    .insert(messages)
    .values({
      organizationId: args.thread.organizationId,
      projectId: args.thread.projectId,
      seq,
      authorMemberId: null,
      kind: "agent",
      agentChannelId: args.agentChannelId,
      body: markdownToTiptap(args.text),
      text: args.text,
      threadId: args.thread.id,
      parentMessageId: args.thread.rootMessageId,
      clientId: `delegation-reply:${args.delegationId}`,
    })
    .onConflictDoNothing({ target: [messages.projectId, messages.clientId] })
    .returning();

  if (!row) return;

  await emitMessageById(row.id, "agent_replied");
}

export async function openDelegationOrigins(
  targetChannelId: string,
): Promise<string[]> {
  const rows = await db
    .select({ originChannelId: delegations.originChannelId })
    .from(delegations)
    .where(
      and(
        eq(delegations.targetChannelId, targetChannelId),
        eq(delegations.status, "open"),
      ),
    );

  return rows.map((row) => row.originChannelId);
}

export async function delegationForChild(
  childThreadId: string,
): Promise<SelectDelegation | null> {
  const row = await db.query.delegations.findFirst({
    where: eq(delegations.childThreadId, childThreadId),
  });
  return row ?? null;
}
