import type { ThreadDetail } from "@roster/api";

import type { MessageItem } from "~/types";

import {
  markFailed,
  mergeMessage,
  mergeMessages,
  prependMessages,
  sortMessages,
} from "./message-cache";

export function detailMessages(detail: ThreadDetail): MessageItem[] {
  return detail.messages as MessageItem[];
}

export function addReply(
  detail: ThreadDetail,
  reply: MessageItem,
): ThreadDetail {
  return {
    ...detail,
    messages: sortMessages([...detailMessages(detail), reply]),
  };
}

export function mergeReply(
  detail: ThreadDetail,
  reply: MessageItem,
): ThreadDetail {
  return { ...detail, messages: mergeMessage(detailMessages(detail), reply) };
}

export function failReply(
  detail: ThreadDetail,
  clientId: string,
): ThreadDetail {
  return { ...detail, messages: markFailed(detailMessages(detail), clientId) };
}

export function mergeDetail(
  previous: ThreadDetail,
  fresh: ThreadDetail,
): ThreadDetail {
  return {
    thread: fresh.thread,
    messages: mergeMessages(detailMessages(previous), detailMessages(fresh)),
  };
}

export function prependReplies(
  detail: ThreadDetail,
  older: MessageItem[],
): ThreadDetail {
  return {
    ...detail,
    messages: prependMessages(detailMessages(detail), older),
  };
}

export function splitThread(detail: ThreadDetail): {
  root: MessageItem | null;
  replies: MessageItem[];
} {
  const all = detailMessages(detail);
  const root = all.find(
    (message) => message.id === detail.thread.rootMessageId,
  );
  if (!root) return { root: null, replies: all };
  return {
    root,
    replies: all.filter((message) => message.id !== root.id),
  };
}
