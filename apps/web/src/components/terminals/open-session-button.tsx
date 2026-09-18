"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@roster/ui";
import { SquareTerminal } from "lucide-react";

import { trpc } from "~/utils/trpc";

import { useDock } from "./dock-provider";

export interface OpenSessionButtonProps {
  projectId: string;
  threadId: string;
}

export function OpenSessionButton({
  projectId,
  threadId,
}: OpenSessionButtonProps) {
  const { select, setMode } = useDock();

  const { data: worktrees } = useQuery({
    queryKey: ["terminals", "worktrees", projectId],
    queryFn: () => trpc.terminals.worktrees.query({ projectId }),
    refetchInterval: 15_000,
  });

  const worktree = worktrees?.find((entry) => entry.threadId === threadId);
  if (!worktree) return null;

  return (
    <Button
      variant="ghost"
      className="!rounded-md gap-1.5 px-1.5 text-xs"
      aria-label="Open this thread's session"
      onClick={() => {
        select({ workspaceId: worktree.workspaceId, terminalId: null });
        setMode("open");
      }}
    >
      <SquareTerminal size={14} />
      <span className="max-sm:hidden">Session</span>
    </Button>
  );
}
