export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  "in_progress",
  "todo",
  "done",
];

export function normalizeTaskStatus(
  value: string | null | undefined,
): TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : "todo";
}
