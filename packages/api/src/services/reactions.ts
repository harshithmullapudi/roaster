import { db, messages, reactions } from "@roster/db";
import { and, eq, isNull } from "drizzle-orm";

import { channelName, publish, threadChannelName } from "./centrifugo";

export interface ReactionRef {
  emoji: string;
  memberId: string;
}

export interface ReactionEvent {
  type: "reaction";
  messageId: string;
  projectId: string;
  threadId: string | null;
  emoji: string;
  memberId: string;
  added: boolean;
}

export interface ReactionTarget {
  id: string;
  projectId: string;
  threadId: string | null;
}

function isReactionRef(value: unknown): value is ReactionRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as Record<string, unknown>;
  return typeof ref.emoji === "string" && typeof ref.memberId === "string";
}

export function toReactionRefs(value: unknown): ReactionRef[] {
  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(isReactionRef)
    .map((ref) => ({ emoji: ref.emoji, memberId: ref.memberId }));
}

export function reactionPayload(args: {
  messageId: string;
  projectId: string;
  threadId: string | null;
  emoji: string;
  memberId: string;
  added: boolean;
}): ReactionEvent {
  return {
    type: "reaction",
    messageId: args.messageId,
    projectId: args.projectId,
    threadId: args.threadId,
    emoji: args.emoji,
    memberId: args.memberId,
    added: args.added,
  };
}

export async function reactionTarget(
  messageId: string,
): Promise<ReactionTarget | null> {
  const [row] = await db
    .select({
      id: messages.id,
      projectId: messages.projectId,
      threadId: messages.threadId,
    })
    .from(messages)
    .where(and(eq(messages.id, messageId), isNull(messages.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function toggleReaction(args: {
  messageId: string;
  memberId: string;
  emoji: string;
}): Promise<{ added: boolean }> {
  const inserted = await db
    .insert(reactions)
    .values({
      messageId: args.messageId,
      memberId: args.memberId,
      emoji: args.emoji,
    })
    .onConflictDoNothing({
      target: [reactions.messageId, reactions.memberId, reactions.emoji],
    })
    .returning({ id: reactions.id });

  const added = inserted.length > 0;

  if (!added) {
    await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.messageId, args.messageId),
          eq(reactions.memberId, args.memberId),
          eq(reactions.emoji, args.emoji),
        ),
      );
  }

  await publishReaction({ ...args, added });

  return { added };
}

async function publishReaction(args: {
  messageId: string;
  memberId: string;
  emoji: string;
  added: boolean;
}): Promise<void> {
  const target = await reactionTarget(args.messageId);
  if (!target) return;

  const payload = reactionPayload({
    messageId: target.id,
    projectId: target.projectId,
    threadId: target.threadId,
    emoji: args.emoji,
    memberId: args.memberId,
    added: args.added,
  });

  const targets = [publish(channelName(target.projectId), payload)];
  if (target.threadId) {
    targets.push(publish(threadChannelName(target.threadId), payload));
  }

  await Promise.all(targets);
}

export async function addReaction(args: {
  messageId: string;
  memberId: string;
  emoji: string;
}): Promise<{ added: boolean }> {
  const inserted = await db
    .insert(reactions)
    .values({
      messageId: args.messageId,
      memberId: args.memberId,
      emoji: args.emoji,
    })
    .onConflictDoNothing({
      target: [reactions.messageId, reactions.memberId, reactions.emoji],
    })
    .returning({ id: reactions.id });

  const added = inserted.length > 0;
  if (added) await publishReaction({ ...args, added });

  return { added };
}
