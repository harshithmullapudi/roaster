"use client";

import type { Task, TaskStatus } from "@roster/api";
import { Button, cn } from "@roster/ui";
import { CircleCheck, Hash, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  type Index,
  type ListRowProps,
} from "react-virtualized";

import { useCommands } from "~/components/providers/command-provider";
import { relativeTime } from "~/utils/relative-time";
import {
  buildRows,
  filterTasks,
  type TaskFilters,
  type TaskGroupBy,
} from "~/utils/task-rows";
import { errorMessage, trpc } from "~/utils/trpc";

import { StatusPicker } from "./status-picker";
import { TASK_STATUS_META, taskStatusColor } from "./task-status";
import { TaskToolbar } from "./task-toolbar";

export interface TaskListProps {
  tasks: Task[];
}

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openNewTask } = useCommands();

  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});

  useEffect(() => setOverrides({}), [tasks]);

  const groupBy: TaskGroupBy =
    searchParams.get("group") === "channel" ? "channel" : "status";

  const filters: TaskFilters = useMemo(
    () => ({
      statuses: parseList(searchParams.get("status")) as TaskStatus[],
      channels: parseList(searchParams.get("channel")),
    }),
    [searchParams],
  );

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const resolved = useMemo(
    () =>
      tasks.map((task) =>
        overrides[task.id] ? { ...task, status: overrides[task.id]! } : task,
      ),
    [tasks, overrides],
  );

  const rows = useMemo(
    () => buildRows(filterTasks(resolved, filters), groupBy),
    [resolved, filters, groupBy],
  );

  const channelSlugs = useMemo(
    () => [...new Set(tasks.map((task) => task.channelSlug))].sort(),
    [tasks],
  );

  const cacheRef = useRef(
    new CellMeasurerCache({ defaultHeight: 44, fixedWidth: true }),
  );
  const cache = cacheRef.current;

  useEffect(() => {
    cache.clearAll();
  }, [cache, rows.length, groupBy]);

  const setStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      setOverrides((current) => ({ ...current, [taskId]: status }));
      setError(null);
      try {
        await trpc.tasks.setStatus.mutate({ taskId, status });
        router.refresh();
      } catch (cause) {
        setOverrides((current) => {
          const next = { ...current };
          delete next[taskId];
          return next;
        });
        setError(errorMessage(cause, "Could not update the task."));
      }
    },
    [router],
  );

  const rowHeight = useCallback(
    ({ index }: Index) =>
      Math.max(
        cache.getHeight(index, 0),
        rows[index]?.type === "header" ? 36 : 44,
      ),
    [cache, rows],
  );

  const rowRenderer = useCallback(
    ({ index, key, style, parent }: ListRowProps) => {
      const row = rows[index];
      if (!row) return null;

      return (
        <CellMeasurer
          key={key}
          cache={cache}
          columnIndex={0}
          parent={parent}
          rowIndex={index}
        >
          <div style={style}>
            {row.type === "header" ? (
              <div className="flex items-center gap-2 px-3 pb-1 pt-3">
                <span
                  className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium"
                  style={
                    row.status
                      ? {
                          backgroundColor: taskStatusColor(row.status)
                            .background,
                          color: taskStatusColor(row.status).color,
                        }
                      : undefined
                  }
                >
                  {row.status ? (
                    TASK_STATUS_META[row.status].label
                  ) : (
                    <>
                      <Hash size={12} />
                      {row.label}
                    </>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {row.count}
                </span>
              </div>
            ) : (
              <div className="group hover:bg-accent/50 mx-2 flex items-center gap-2 rounded-lg px-2 py-2">
                <StatusPicker
                  value={row.task.status}
                  onChange={(status) => void setStatus(row.task.id, status)}
                  variant="bare"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    row.task.status === "done" &&
                      "text-muted-foreground line-through",
                  )}
                >
                  {row.task.title}
                </span>
                {groupBy !== "channel" && (
                  <span className="text-muted-foreground hidden shrink-0 items-center gap-0.5 text-xs sm:flex">
                    <Hash size={11} />
                    {row.task.channelSlug}
                  </span>
                )}
                <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">
                  {relativeTime(row.task.createdAt)}
                </span>
              </div>
            )}
          </div>
        </CellMeasurer>
      );
    },
    [rows, cache, setStatus, groupBy],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TaskToolbar
        filters={filters}
        onFiltersChange={(next) =>
          updateParams({
            status: next.statuses.join(",") || null,
            channel: next.channels.join(",") || null,
          })
        }
        groupBy={groupBy}
        onGroupByChange={(next) =>
          updateParams({ group: next === "status" ? null : next })
        }
        channelSlugs={channelSlugs}
      />

      {error && (
        <p className="text-destructive px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <CircleCheck className="text-muted-foreground size-7" />
          <p className="text-muted-foreground text-sm">
            {tasks.length === 0
              ? "No tasks yet"
              : "No tasks match these filters"}
          </p>
          {tasks.length === 0 && (
            <Button variant="secondary" onClick={openNewTask}>
              <Plus size={14} className="mr-1" />
              New task
            </Button>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <AutoSizer>
            {({ width, height }) => (
              <List
                height={height}
                width={width}
                rowCount={rows.length}
                rowHeight={rowHeight}
                rowRenderer={rowRenderer}
                deferredMeasurementCache={cache}
                overscanRowCount={8}
              />
            )}
          </AutoSizer>
        </div>
      )}
    </div>
  );
}
