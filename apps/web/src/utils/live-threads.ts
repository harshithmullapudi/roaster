import type { LiveThread } from "@roster/api";

import { isLive, needsInput } from "./thread-rows";

export type LiveThreadItem = Omit<LiveThread, "startedAt"> & {
  startedAt: Date;
};

export function liveThreadsKey() {
  return ["threads", "live"] as const;
}

export function threadTitle(rootText: string): string {
  return rootText.split("\n")[0]?.trim() || "Untitled";
}

export interface StateCounts {
  running: number;
  needsInput: number;
  turnDone: number;
}

export interface SessionState {
  status: string;
  turnUnseen?: boolean;
}

/*
 * A thread waiting on a person is not a thread that is working, and counting
 * the two together hides the only one you can act on. A thread that has come
 * to rest with an unread turn is a third thing again: nothing is happening,
 * but there is something new to read.
 */
export function countByState(threads: SessionState[]): StateCounts {
  let running = 0;
  let waiting = 0;
  let done = 0;

  for (const thread of threads) {
    if (needsInput(thread.status)) waiting += 1;
    else if (isLive(thread.status)) running += 1;
    else if (thread.turnUnseen) done += 1;
  }

  return { running, needsInput: waiting, turnDone: done };
}

export function sessionsHeading(counts: StateCounts, total: number): string {
  if (counts.needsInput > 0) {
    return `${counts.needsInput} of ${total} waiting on you`;
  }

  if (counts.turnDone > 0) {
    if (counts.turnDone < total) {
      return `${counts.turnDone} of ${total} finished their turn`;
    }
    return counts.turnDone === 1
      ? "1 turn completed"
      : `${counts.turnDone} turns completed`;
  }

  return total === 1 ? "1 session running" : `${total} sessions running`;
}

export interface SessionItem {
  id: string;
  title: string;
  channelSlug: string;
  status: string;
  turnUnseen: boolean;
  href: string;
}

export function toSessionItems(
  threads: LiveThreadItem[],
  channels: { id: string; slug: string }[],
  orgSlug: string,
): SessionItem[] {
  const slugs = new Map(channels.map((channel) => [channel.id, channel.slug]));
  const items: SessionItem[] = [];

  for (const thread of threads) {
    const slug = slugs.get(thread.projectId);
    if (!slug) continue;

    items.push({
      id: thread.id,
      title: threadTitle(thread.rootText),
      channelSlug: slug,
      status: thread.status,
      turnUnseen: thread.turnUnseen,
      href: `/${orgSlug}/${slug}?thread=${thread.id}`,
    });
  }

  return items;
}

export function groupByChannel(
  threads: LiveThreadItem[],
): Map<string, LiveThreadItem[]> {
  const grouped = new Map<string, LiveThreadItem[]>();

  for (const thread of threads) {
    const existing = grouped.get(thread.projectId);
    if (existing) existing.push(thread);
    else grouped.set(thread.projectId, [thread]);
  }

  return grouped;
}
