import type { LiveThread } from "@roster/api";

export type LiveThreadItem = Omit<LiveThread, "startedAt"> & {
  startedAt: Date;
};

export function liveThreadsKey() {
  return ["threads", "live"] as const;
}

export function threadTitle(rootText: string): string {
  return rootText.split("\n")[0]?.trim() || "Untitled";
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
