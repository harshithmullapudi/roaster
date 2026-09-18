import type { MessageItem } from "~/types";

export const PENDING_SEQ = Number.MAX_SAFE_INTEGER;

export function channelMessagesKey(projectId: string) {
  return ["messages", projectId] as const;
}

export function sortMessages(list: MessageItem[]): MessageItem[] {
  return [...list].sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function mergeMessage(
  list: MessageItem[],
  incoming: MessageItem,
): MessageItem[] {
  const kept = list.filter((message) =>
    incoming.clientId
      ? message.clientId !== incoming.clientId
      : message.id !== incoming.id,
  );

  const alreadyStored = kept.some(
    (message) => !message.pending && message.seq === incoming.seq,
  );
  if (alreadyStored) {
    return kept.length === list.length ? list : sortMessages(kept);
  }

  return sortMessages([...kept, incoming]);
}

export function mergeMessages(
  list: MessageItem[],
  incoming: MessageItem[],
): MessageItem[] {
  if (incoming.length === 0) return list;

  const clientIds = new Set(
    incoming
      .map((message) => message.clientId)
      .filter((clientId): clientId is string => Boolean(clientId)),
  );
  const seqs = new Set(incoming.map((message) => message.seq));

  const kept = list.filter((message) => {
    if (message.clientId && clientIds.has(message.clientId)) return false;
    if (!message.pending && seqs.has(message.seq)) return false;
    return true;
  });

  return sortMessages([...kept, ...incoming]);
}

export function removeMessage(
  list: MessageItem[],
  messageId: string,
): MessageItem[] {
  const kept = list.filter((message) => message.id !== messageId);
  return kept.length === list.length ? list : kept;
}

export function markFailed(
  list: MessageItem[],
  clientId: string,
): MessageItem[] {
  return list.map((message) =>
    message.clientId === clientId && message.pending
      ? { ...message, pending: false, failed: true }
      : message,
  );
}

export function optimisticMessage(args: {
  projectId: string;
  clientId: string;
  body: unknown;
  text: string;
  authorName: string;
  authorEmail: string;
}): MessageItem {
  return {
    id: args.clientId,
    projectId: args.projectId,
    seq: PENDING_SEQ,
    kind: "user",
    agentChannelId: null,
    agentDisplay: null,
    agentHandle: null,
    body: args.body,
    text: args.text,
    clientId: args.clientId,
    parentMessageId: null,
    threadId: null,
    createdAt: new Date(),
    editedAt: null,
    authorMemberId: null,
    authorName: args.authorName,
    authorEmail: args.authorEmail,
    pending: true,
  };
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface MessageDeletion {
  messageId: string;
  projectId: string;
  threadId: string | null;
}

export function parsePublishedDeletion(data: unknown): MessageDeletion | null {
  if (typeof data !== "object" || data === null) return null;

  const raw = data as Record<string, unknown>;
  if (raw.type !== "message-deleted") return null;
  if (typeof raw.messageId !== "string" || typeof raw.projectId !== "string") {
    return null;
  }

  return {
    messageId: raw.messageId,
    projectId: raw.projectId,
    threadId: typeof raw.threadId === "string" ? raw.threadId : null,
  };
}

export function parsePublishedMessage(data: unknown): MessageItem | null {
  if (typeof data !== "object" || data === null) return null;

  const envelope = data as { type?: unknown; message?: unknown };
  if (envelope.type !== "message") return null;
  if (typeof envelope.message !== "object" || envelope.message === null) {
    return null;
  }

  const raw = envelope.message as Record<string, unknown>;
  const createdAt = asDate(raw.createdAt);
  if (
    typeof raw.id !== "string" ||
    typeof raw.projectId !== "string" ||
    typeof raw.seq !== "number" ||
    typeof raw.text !== "string" ||
    !createdAt
  ) {
    return null;
  }

  return {
    id: raw.id,
    projectId: raw.projectId,
    seq: raw.seq,
    kind: typeof raw.kind === "string" ? raw.kind : "user",
    agentChannelId:
      typeof raw.agentChannelId === "string" ? raw.agentChannelId : null,
    agentDisplay: typeof raw.agentDisplay === "string" ? raw.agentDisplay : null,
    agentHandle: typeof raw.agentHandle === "string" ? raw.agentHandle : null,
    body: raw.body,
    text: raw.text,
    clientId: typeof raw.clientId === "string" ? raw.clientId : null,
    parentMessageId:
      typeof raw.parentMessageId === "string" ? raw.parentMessageId : null,
    threadId: typeof raw.threadId === "string" ? raw.threadId : null,
    createdAt,
    editedAt: asDate(raw.editedAt),
    authorMemberId:
      typeof raw.authorMemberId === "string" ? raw.authorMemberId : null,
    authorName: typeof raw.authorName === "string" ? raw.authorName : null,
    authorEmail: typeof raw.authorEmail === "string" ? raw.authorEmail : null,
  };
}
