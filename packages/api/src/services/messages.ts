import { db, members, messages, users } from "@roster/db";
import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";

import { allocateSeq } from "./channels";

export interface ChannelMessage {
  id: string;
  projectId: string;
  seq: number;
  kind: string;
  body: unknown;
  text: string;
  clientId: string | null;
  parentMessageId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  authorMemberId: string | null;
  authorName: string | null;
  authorEmail: string | null;
}

const messageColumns = {
  id: messages.id,
  projectId: messages.projectId,
  seq: messages.seq,
  kind: messages.kind,
  body: messages.body,
  text: messages.text,
  clientId: messages.clientId,
  parentMessageId: messages.parentMessageId,
  createdAt: messages.createdAt,
  editedAt: messages.editedAt,
  authorMemberId: messages.authorMemberId,
  authorName: users.name,
  authorEmail: users.email,
};

function toChannelMessage(row: {
  id: string;
  projectId: string;
  seq: number;
  kind: string;
  body: unknown;
  text: string;
  clientId: string | null;
  parentMessageId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  authorMemberId: string | null;
  authorName: string | null;
  authorEmail: string | null;
}): ChannelMessage {
  return { ...row, seq: Number(row.seq) };
}

export async function listMessages(args: {
  projectId: string;
  before?: number;
  limit?: number;
}): Promise<ChannelMessage[]> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

  const conditions = [
    eq(messages.projectId, args.projectId),
    isNull(messages.deletedAt),
  ];
  if (args.before !== undefined) conditions.push(lt(messages.seq, args.before));

  const rows = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(members, eq(messages.authorMemberId, members.id))
    .leftJoin(users, eq(members.userId, users.id))
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
    .where(eq(messages.id, id))
    .limit(1);

  if (!row) throw new Error("Message not found.");
  return toChannelMessage(row);
}

export function publishMessage(_message: ChannelMessage): void {}

export async function sendMessage(args: {
  organizationId: string;
  projectId: string;
  authorMemberId: string;
  body: unknown;
  text: string;
  clientId: string;
}): Promise<ChannelMessage> {
  const existing = await findByClientId({
    projectId: args.projectId,
    clientId: args.clientId,
  });
  if (existing) return existing;

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

  publishMessage(row);

  return row;
}
