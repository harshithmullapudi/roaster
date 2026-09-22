"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@roster/ui";
import { SquareTerminal } from "lucide-react";

import { SessionCounts } from "~/components/threads/session-counts";
import { countByState } from "~/utils/live-threads";
import { threadsKey } from "~/utils/thread-rows";
import { trpc } from "~/utils/trpc";

import { useDock } from "./dock-provider";

function ThreadCounts({
  projectId,
  onOpen,
}: {
  projectId: string;
  onOpen: () => void;
}) {
  const { data: threads } = useQuery({
    queryKey: threadsKey(projectId),
    queryFn: () => trpc.threads.list.query({ projectId }),
    refetchInterval: 10_000,
  });

  const { data: worktrees } = useQuery({
    queryKey: ["terminals", "worktrees", projectId],
    queryFn: () => trpc.terminals.worktrees.query({ projectId }),
    refetchInterval: 15_000,
  });

  const counts = countByState(threads ?? []);
  const open = worktrees?.length ?? 0;

  if (open === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-2.5 text-xs"
    >
      <span>{open} open</span>
      <SessionCounts
        running={counts.running}
        needsInput={counts.needsInput}
        labeled
      />
    </button>
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
        <ThreadCounts
          projectId={channel.projectId}
          onOpen={() => setMode("open")}
        />
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
