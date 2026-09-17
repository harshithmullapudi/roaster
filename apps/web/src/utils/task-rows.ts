import type { Task } from "@roster/api";
import { TASK_STATUS_ORDER, type TaskStatus } from "@roster/api/client";

export type TaskGroupBy = "status" | "channel";

export type TaskRow =
  | {
      type: "header";
      id: string;
      label: string;
      count: number;
      status: TaskStatus | null;
    }
  | { type: "item"; id: string; task: Task };

export interface TaskFilters {
  statuses: TaskStatus[];
  channels: string[];
}

export const EMPTY_FILTERS: TaskFilters = { statuses: [], channels: [] };

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
      !filters.channels.includes(task.channelSlug)
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
    const group = bySlug.get(task.channelSlug);
    if (group) group.push(task);
    else bySlug.set(task.channelSlug, [task]);
  }

  for (const slug of [...bySlug.keys()].sort()) {
    const group = bySlug.get(slug) ?? [];
    rows.push({
      type: "header",
      id: `channel:${slug}`,
      label: slug,
      count: group.length,
      status: null,
    });
    for (const task of group) {
      rows.push({ type: "item", id: task.id, task });
    }
  }

  return rows;
}
