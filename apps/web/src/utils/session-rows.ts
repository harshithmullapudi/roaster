import { displayName } from "./message-groups";
import { statusLabel, type ThreadItem } from "./thread-rows";

export const SESSION_STATUS_ORDER = [
  "running",
  "starting",
  "waiting",
  "completed",
  "failed",
  "canceled",
] as const;

export type SessionGroupBy = "status" | "author";

export interface SessionFilters {
  statuses: string[];
}

export const EMPTY_SESSION_FILTERS: SessionFilters = { statuses: [] };

export type SessionRowModel =
  | {
      type: "header";
      id: string;
      label: string;
      count: number;
      status: string | null;
    }
  | { type: "item"; id: string; thread: ThreadItem };

export function filterSessions(
  threads: ThreadItem[],
  filters: SessionFilters,
): ThreadItem[] {
  if (filters.statuses.length === 0) return threads;
  return threads.filter((thread) => filters.statuses.includes(thread.status));
}

/**
 * Same shape the task list uses: a header per group, newest session first
 * inside each one.
 */
export function buildSessionRows(
  threads: ThreadItem[],
  groupBy: SessionGroupBy,
): SessionRowModel[] {
  const byRecency = [...threads].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
  const rows: SessionRowModel[] = [];

  const push = (
    id: string,
    label: string,
    status: string | null,
    group: ThreadItem[],
  ) => {
    if (group.length === 0) return;
    rows.push({ type: "header", id, label, count: group.length, status });
    for (const thread of group) {
      rows.push({ type: "item", id: thread.id, thread });
    }
  };

  if (groupBy === "status") {
    const known = new Set<string>(SESSION_STATUS_ORDER);
    const order = [
      ...SESSION_STATUS_ORDER,
      ...[
        ...new Set(
          byRecency
            .map((thread) => thread.status)
            .filter((status) => !known.has(status)),
        ),
      ].sort(),
    ];

    for (const status of order) {
      push(
        `status:${status}`,
        statusLabel(status),
        status,
        byRecency.filter((thread) => thread.status === status),
      );
    }
    return rows;
  }

  const byAuthor = new Map<string, ThreadItem[]>();
  for (const thread of byRecency) {
    const author = displayName(thread.authorName, thread.authorEmail);
    const group = byAuthor.get(author);
    if (group) group.push(thread);
    else byAuthor.set(author, [thread]);
  }

  for (const author of [...byAuthor.keys()].sort()) {
    push(`author:${author}`, author, null, byAuthor.get(author) ?? []);
  }

  return rows;
}
