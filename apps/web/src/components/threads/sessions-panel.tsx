"use client";

import { useQuery } from "@tanstack/react-query";
import { Radio, User } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  type Index,
  type ListRowProps,
} from "react-virtualized";

import { useChannelRealtime } from "~/hooks/use-channel-realtime";
import { useNow } from "~/hooks/use-now";
import {
  buildSessionRows,
  filterSessions,
  type SessionFilters,
  type SessionGroupBy,
} from "~/utils/session-rows";
import {
  isLive,
  statusLabel,
  type ThreadItem,
  threadsKey,
} from "~/utils/thread-rows";
import { trpc } from "~/utils/trpc";

import { SessionRow } from "./session-row";
import { sessionStatusColor } from "./session-status";
import { SessionToolbar } from "./session-toolbar";

export interface SessionsPanelProps {
  projectId: string;
  basePath: string;
  initialThreads: ThreadItem[];
}

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function SessionsPanel({
  projectId,
  basePath,
  initialThreads,
}: SessionsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: threads } = useQuery({
    queryKey: threadsKey(projectId),
    queryFn: () => trpc.threads.list.query({ projectId }),
    initialData: initialThreads,
  });

  useChannelRealtime(projectId);

  const now = useNow(threads.some((thread) => isLive(thread.status)));

  const groupBy: SessionGroupBy =
    searchParams.get("group") === "author" ? "author" : "status";

  const filters: SessionFilters = useMemo(
    () => ({ statuses: parseList(searchParams.get("status")) }),
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

  const rows = useMemo(
    () => buildSessionRows(filterSessions(threads, filters), groupBy),
    [threads, filters, groupBy],
  );

  const cacheRef = useRef(
    new CellMeasurerCache({ defaultHeight: 44, fixedWidth: true }),
  );
  const cache = cacheRef.current;

  useEffect(() => {
    cache.clearAll();
  }, [cache, rows.length, groupBy]);

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
                          backgroundColor: sessionStatusColor(row.status)
                            .background,
                          color: sessionStatusColor(row.status).color,
                        }
                      : undefined
                  }
                >
                  {row.status ? (
                    statusLabel(row.status)
                  ) : (
                    <>
                      <User size={12} />
                      {row.label}
                    </>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {row.count}
                </span>
              </div>
            ) : (
              <SessionRow
                thread={row.thread}
                href={`${basePath}/thread/${row.thread.id}`}
                now={now}
                showAuthor={groupBy !== "author"}
              />
            )}
          </div>
        </CellMeasurer>
      );
    },
    [rows, cache, basePath, now, groupBy],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SessionToolbar
        filters={filters}
        onFiltersChange={(next) =>
          updateParams({ status: next.statuses.join(",") || null })
        }
        groupBy={groupBy}
        onGroupByChange={(next) =>
          updateParams({ group: next === "status" ? null : next })
        }
      />

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Radio className="text-muted-foreground size-7" />
          <p className="text-muted-foreground text-sm">
            {threads.length === 0
              ? "Send a message in this channel and a session starts here"
              : "No sessions match these filters"}
          </p>
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
