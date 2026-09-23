"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@roster/ui";
import { SquareTerminal } from "lucide-react";

import { SessionCounts } from "~/components/threads/session-counts";
import {
  type HoverCardThread,
  SessionsHoverCard,
} from "~/components/threads/sessions-hover-card";
import { countByState, sessionsHeading } from "~/utils/live-threads";
import {
  isActive,
  type ThreadItem,
  threadsKey,
  turnUnseen,
} from "~/utils/thread-rows";
import { trpc } from "~/utils/trpc";

import { type DockChannel, useDock } from "./dock-provider";

function toSessions(threads: ThreadItem[]): HoverCardThread[] {
  const sessions: HoverCardThread[] = [];

  for (const thread of threads) {
    const unseen = turnUnseen(thread);
    if (!unseen && !isActive(thread.status, thread.completedAt)) continue;

    sessions.push({
      id: thread.id,
      rootText: thread.rootText,
      status: thread.status,
      lastProgress: thread.lastProgress,
      turnUnseen: unseen,
    });
  }

  return sessions;
}

function ThreadCounts({
  channel,
  onOpen,
}: {
  channel: DockChannel;
  onOpen: () => void;
}) {
  const { data: threads } = useQuery({
    queryKey: threadsKey(channel.projectId),
    queryFn: () => trpc.threads.list.query({ projectId: channel.projectId }),
    refetchInterval: 10_000,
  });

  const { data: worktrees } = useQuery({
    queryKey: ["terminals", "worktrees", channel.projectId],
    queryFn: () => trpc.terminals.worktrees.query({ projectId: channel.projectId }),
    refetchInterval: 15_000,
  });

  const sessions = toSessions(threads ?? []);
  const counts = countByState(sessions);
  const open = worktrees?.length ?? 0;

  if (open === 0 && sessions.length === 0) return null;

  const button = (
    <button
      type="button"
      onClick={onOpen}
      className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-2.5 text-xs"
    >
      {open > 0 ? <span>{open} open</span> : null}
      <SessionCounts
        running={counts.running}
        needsInput={counts.needsInput}
        turnDone={counts.turnDone}
        labeled
      />
    </button>
  );

  if (sessions.length === 0) return button;

  return (
    <SessionsHoverCard
      threads={sessions}
      basePath={`/${channel.orgSlug}/${channel.channelSlug}`}
      heading={sessionsHeading(counts, sessions.length)}
      side="top"
      align="end"
    >
      {button}
    </SessionsHoverCard>
  );
}

export function DockStatusBar() {
  const { channel, mode, setMode, toggle } = useDock();

  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-end gap-2",
        mode === "open" || !channel ? "px-1.5 py-1" : "p-2",
      )}
    >
      {channel ? (
        <ThreadCounts channel={channel} onOpen={() => setMode("open")} />
      ) : null}

      <button
        type="button"
        onClick={toggle}
        disabled={!channel}
        aria-label="Toggle agent sessions"
        className={cn(
          "text-muted-foreground hover:bg-accent hover:text-foreground flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
          !channel && "pointer-events-none opacity-40",
        )}
      >
        <SquareTerminal size={13} />
        <span>Agent</span>
      </button>
    </footer>
  );
}
