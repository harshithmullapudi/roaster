import type { Task } from "@roster/api";
import { TASK_STATUS_ORDER, type TaskStatus } from "@roster/api/client";

export type TaskGroupBy = "status" | "channel";

export const UNASSIGNED = "~unassigned";
export const UNASSIGNED_LABEL = "Backlog";

export type TaskRow =
  | {
      type: "header";
      id: string;
      label: string;
      count: number;
      status: TaskStatus | null;
      backlog?: true;
    }
  | { type: "item"; id: string; task: Task };

export interface TaskFilters {
  statuses: TaskStatus[];
  channels: string[];
}

export const EMPTY_FILTERS: TaskFilters = { statuses: [], channels: [] };

export function channelKey(task: Task): string {
  return task.channelSlug ?? UNASSIGNED;
}

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((task) => {
    if (
      filters.statuses.length > 0 &&
      !filters.statuses.includes(task.status)
    ) {
      return false;
    }
    if (
      filters.channels.length > 0 &&
      !filters.channels.includes(channelKey(task))
    ) {
      return false;
    }
    return true;
  });
}

export function buildRows(tasks: Task[], groupBy: TaskGroupBy): TaskRow[] {
  const rows: TaskRow[] = [];

  if (groupBy === "status") {
    for (const status of TASK_STATUS_ORDER) {
      const group = tasks.filter((task) => task.status === status);
      if (group.length === 0) continue;
      rows.push({
        type: "header",
        id: `status:${status}`,
        label: status,
        count: group.length,
        status,
      });
      for (const task of group) {
        rows.push({ type: "item", id: task.id, task });
      }
    }
    return rows;
  }

  const bySlug = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = channelKey(task);
    const group = bySlug.get(key);
    if (group) group.push(task);
    else bySlug.set(key, [task]);
  }

  const keys = [...bySlug.keys()].filter((key) => key !== UNASSIGNED).sort();
  if (bySlug.has(UNASSIGNED)) keys.unshift(UNASSIGNED);

  for (const key of keys) {
    const group = bySlug.get(key) ?? [];
    rows.push({
      type: "header",
      id: `channel:${key}`,
      label: key === UNASSIGNED ? UNASSIGNED_LABEL : key,
      count: group.length,
      status: null,
      ...(key === UNASSIGNED ? { backlog: true as const } : {}),
    });
    for (const task of group) {
      rows.push({ type: "item", id: task.id, task });
    }
  }

  return rows;
}
