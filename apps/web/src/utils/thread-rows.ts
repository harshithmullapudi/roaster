import type { ThreadSummary, WaitingOn } from "@roster/api";

export type ThreadItem = Omit<ThreadSummary, "startedAt" | "endedAt"> & {
  startedAt: Date;
  endedAt: Date | null;
};

export function threadsKey(projectId: string) {
  return ["threads", projectId] as const;
}

export function threadDetailKey(threadId: string) {
  return ["thread", threadId] as const;
}

export function isLive(status: string): boolean {
  return status === "starting" || status === "running";
}

export function isWaiting(status: string): boolean {
  return status === "waiting";
}

/**
 * Still someone's turn. A parked thread is not running itself, but another
 * agent is running on its behalf — so it keeps its status card, its cancel
 * button and its ticking clock.
 */
export function isActive(status: string): boolean {
  return isLive(status) || isWaiting(status);
}

export function canRetry(status: string, error: string | null): boolean {
  if (status === "failed") return true;
  return isLive(status) && error !== null;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "starting":
      return "Starting";
    case "running":
      return "Running";
    case "waiting":
      return "Waiting";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return status;
  }
}

/**
 * One line for a parked thread: who is working on it, and what they last
 * said. Falls back to their status so it never reads as an idle agent.
 */
export function waitingOnLabel(waiting: WaitingOn | null): string | null {
  if (!waiting) return null;

  const progress = waiting.lastProgress?.trim();
  const state =
    progress && progress.length > 0 ? progress : statusLabel(waiting.status);
  return `@${waiting.handle} · ${state}`;
}

function parseWaitingOn(value: unknown): WaitingOn | null {
  if (typeof value !== "object" || value === null) return null;

  const raw = value as Record<string, unknown>;
  if (
    typeof raw.handle !== "string" ||
    typeof raw.display !== "string" ||
    typeof raw.channelId !== "string" ||
    typeof raw.channelSlug !== "string" ||
    typeof raw.status !== "string" ||
    typeof raw.task !== "string"
  ) {
    return null;
  }

  return {
    handle: raw.handle,
    display: raw.display,
    channelId: raw.channelId,
    channelSlug: raw.channelSlug,
    threadId: typeof raw.threadId === "string" ? raw.threadId : null,
    status: raw.status,
    lastProgress:
      typeof raw.lastProgress === "string" ? raw.lastProgress : null,
    task: raw.task,
  };
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parsePublishedThread(data: unknown): ThreadItem | null {
  if (typeof data !== "object" || data === null) return null;

  const envelope = data as { type?: unknown; thread?: unknown };
  if (envelope.type !== "thread") return null;
  if (typeof envelope.thread !== "object" || envelope.thread === null) {
    return null;
  }

  const raw = envelope.thread as Record<string, unknown>;
  const startedAt = asDate(raw.startedAt);
  if (
    typeof raw.id !== "string" ||
    typeof raw.projectId !== "string" ||
    typeof raw.rootMessageId !== "string" ||
    typeof raw.status !== "string" ||
    !startedAt
  ) {
    return null;
  }

  return {
    id: raw.id,
    projectId: raw.projectId,
    rootMessageId: raw.rootMessageId,
    status: raw.status,
    lastProgress:
      typeof raw.lastProgress === "string" ? raw.lastProgress : null,
    error: typeof raw.error === "string" ? raw.error : null,
    startedAt,
    endedAt: asDate(raw.endedAt),
    rootText: typeof raw.rootText === "string" ? raw.rootText : "",
    authorName: typeof raw.authorName === "string" ? raw.authorName : null,
    authorEmail: typeof raw.authorEmail === "string" ? raw.authorEmail : null,
    replyCount: typeof raw.replyCount === "number" ? raw.replyCount : 0,
    lastReplyAt: asDate(raw.lastReplyAt),
    replierNames: Array.isArray(raw.replierNames)
      ? raw.replierNames.filter(
          (name): name is string => typeof name === "string",
        )
      : [],
    waitingOn: parseWaitingOn(raw.waitingOn),
  };
}

export function mergeThread(
  list: ThreadItem[],
  incoming: ThreadItem,
): ThreadItem[] {
  const index = list.findIndex((thread) => thread.id === incoming.id);
  if (index === -1) return [incoming, ...list];

  const previous = list[index];
  const merged: ThreadItem = {
    ...incoming,
    rootText: incoming.rootText || (previous?.rootText ?? ""),
    authorName: incoming.authorName ?? previous?.authorName ?? null,
    authorEmail: incoming.authorEmail ?? previous?.authorEmail ?? null,
    replyCount: Math.max(incoming.replyCount, previous?.replyCount ?? 0),
    lastReplyAt: incoming.lastReplyAt ?? previous?.lastReplyAt ?? null,
    replierNames:
      incoming.replierNames.length > 0
        ? incoming.replierNames
        : (previous?.replierNames ?? []),
  };

  const next = [...list];
  next[index] = merged;
  return next;
}

export function removeThread(
  list: ThreadItem[],
  threadId: string,
): ThreadItem[] {
  const kept = list.filter((thread) => thread.id !== threadId);
  return kept.length === list.length ? list : kept;
}

export function countReply(
  list: ThreadItem[],
  args: { threadId: string; createdAt: Date; replierName: string },
): ThreadItem[] {
  const index = list.findIndex((thread) => thread.id === args.threadId);
  if (index === -1) return list;

  const previous = list[index];
  if (!previous) return list;

  const next = [...list];
  next[index] = {
    ...previous,
    replyCount: previous.replyCount + 1,
    lastReplyAt:
      previous.lastReplyAt && previous.lastReplyAt > args.createdAt
        ? previous.lastReplyAt
        : args.createdAt,
    replierNames: previous.replierNames.includes(args.replierName)
      ? previous.replierNames
      : [...previous.replierNames, args.replierName],
  };
  return next;
}

export function replyCountLabel(count: number): string {
  return count === 1 ? "1 reply" : `${count} replies`;
}
