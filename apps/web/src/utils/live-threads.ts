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
}

/*
 * A thread waiting on a person is not a thread that is working, and counting
 * the two together hides the only one you can act on.
 */
export function countByState(threads: { status: string }[]): StateCounts {
  let running = 0;
  let waiting = 0;

  for (const thread of threads) {
    if (needsInput(thread.status)) waiting += 1;
    else if (isLive(thread.status)) running += 1;
  }

  return { running, needsInput: waiting };
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
