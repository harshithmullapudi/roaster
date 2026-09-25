import {
  db,
  members,
  messages,
  type NotificationType,
  threads,
  users,
} from "@roster/db";
import { eq } from "drizzle-orm";

import { sessionErrorDetail } from "../utils/session-error";
import {
  channelName,
  publish,
  threadChannelName,
} from "./centrifugo";
import {

  type ChannelMessage,
  messageColumns,
  toChannelMessage,
  withAttachment,
} from "./message-columns";
import {
  ensureThreadSubscription,
  notifyForMessage,
} from "./notifications";

export async function messageById(id: string): Promise<ChannelMessage> {
  const [row] = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
    .where(eq(messages.id, id))
    .limit(1);

  if (!row) throw new Error("Message not found.");
  return withAttachment(toChannelMessage(row));
}

export async function publishMessage(message: ChannelMessage): Promise<void> {
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

async function bumpThreadActivity(threadId: string): Promise<void> {
  await db
    .update(threads)
    .set({ lastActivityAt: new Date() })
    .where(eq(threads.id, threadId));
}

export async function emitMessage(
  message: ChannelMessage,
  outcome?: NotificationType,
): Promise<void> {
  await publishMessage(message);

  const threadId = message.threadId;
  if (!threadId) return;

  try {
    await bumpThreadActivity(threadId);

    if (message.authorMemberId) {
      await ensureThreadSubscription({
        threadId,
        memberId: message.authorMemberId,
        reason: "replied",
      });
    }

    await notifyForMessage(message, outcome);
  } catch (cause) {
    console.warn(
      `[messages] notifying about ${message.id} failed: ${sessionErrorDetail(cause)}`,
    );
  }
}

export async function emitMessageById(
  id: string,
  outcome?: NotificationType,
): Promise<ChannelMessage> {
  const message = await messageById(id);
  await emitMessage(message, outcome);
  return message;
}
