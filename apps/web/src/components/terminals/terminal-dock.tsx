"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@roster/ui";
import { Maximize2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

import { useDock } from "./dock-provider";
import { NewSessionPopover } from "./new-session-popover";
import { SessionTabs } from "./session-tabs";
import { TerminalView } from "./terminal-view";

const MIN_HEIGHT = 160;

function worktreeLabel(label: string): string {
  const firstLine = label.split("\n")[0]?.trim() ?? "";
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine || "Untitled";
}

export function TerminalDock() {
  const { channel, mode, setMode, selection, select, height, setHeight } = useDock();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = channel?.projectId ?? null;

  const { data: worktrees } = useQuery({
    queryKey: ["terminals", "worktrees", projectId],
    queryFn: () => trpc.terminals.worktrees.query({ projectId: projectId as string }),
    enabled: Boolean(projectId) && mode !== "closed",
    refetchInterval: 15_000,
  });

  const activeWorktree = useMemo(() => {
    if (!worktrees?.length) return null;
    const chosen = worktrees.find(
      (worktree) => worktree.workspaceId === selection?.workspaceId,
    );
    return chosen ?? worktrees[0] ?? null;
  }, [worktrees, selection]);

  const workspaceId = activeWorktree?.workspaceId ?? null;

  const { data: sessions } = useQuery({
    queryKey: ["terminals", "sessions", projectId, workspaceId],
    queryFn: () =>
      trpc.terminals.sessions.query({
        projectId: projectId as string,
        workspaceId: workspaceId as string,
      }),
    enabled: Boolean(projectId && workspaceId) && mode !== "closed",
    refetchInterval: 10_000,
  });

  const live = useMemo(
    () => (sessions ?? []).filter((session) => !session.exited),
    [sessions],
  );

  const activeTerminalId = useMemo(() => {
    if (!live.length) return null;
    const chosen = live.find(
      (session) => session.terminalId === selection?.terminalId,
    );
    return (chosen ?? live[0])?.terminalId ?? null;
  }, [live, selection]);

  useEffect(() => {
    if (!workspaceId) return;
    if (
      selection?.workspaceId === workspaceId &&
      selection.terminalId === activeTerminalId
    ) {
      return;
    }
    select({ workspaceId, terminalId: activeTerminalId });
  }, [workspaceId, activeTerminalId, selection, select]);

  const refreshSessions = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["terminals", "sessions", projectId, workspaceId],
    });
  }, [queryClient, projectId, workspaceId]);

  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const onDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startY: event.clientY, startHeight: height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = drag.startHeight + (drag.startY - event.clientY);
    setHeight(Math.min(Math.max(next, MIN_HEIGHT), window.innerHeight - 120));
  };

  const onDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (mode === "closed" || !channel || !projectId) return null;

  const closeSession = async (terminalId: string) => {
    if (!workspaceId) return;
    try {
      await trpc.terminals.close.mutate({ projectId, workspaceId, terminalId });
    } catch (cause) {
      console.warn(errorMessage(cause, "Could not close that session."));
    }
    refreshSessions();
  };

  return (
    <div
      className="bg-background-2 relative flex shrink-0 flex-col overflow-hidden border-t border-gray-300"
      style={{ height }}
    >
      <div
        role="separator"
        aria-label="Resize agent panel"
        onPointerDown={onDragStart}
        onPointerMove={onDrag}
        onPointerUp={onDragEnd}
        className="group absolute inset-x-0 top-0 z-10 flex h-1.5 cursor-row-resize items-center justify-center"
      >
        <span className="bg-muted-foreground/50 group-hover:bg-muted-foreground h-0.5 w-4 rounded-full transition-colors" />
      </div>

      <div className="flex items-center gap-1.5 p-1.5">
        <Select
          value={workspaceId ?? undefined}
          onValueChange={(next) => select({ workspaceId: next, terminalId: null })}
        >
          <SelectTrigger
            showIcon
            className="!h-6 !min-h-6 w-44 shrink-0 px-2 text-xs"
          >
            <SelectValue placeholder="No threads yet" />
          </SelectTrigger>
          <SelectContent className="max-w-72">
            {(worktrees ?? []).map((worktree) => (
              <SelectItem key={worktree.workspaceId} value={worktree.workspaceId}>
                <span className="block truncate">
                  {worktreeLabel(worktree.label)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SessionTabs
          sessions={live}
          activeTerminalId={activeTerminalId}
          onSelect={(terminalId) =>
            workspaceId && select({ workspaceId, terminalId })
          }
          onClose={(terminalId) => void closeSession(terminalId)}
        />

        {workspaceId ? (
          <NewSessionPopover
            projectId={projectId}
            workspaceId={workspaceId}
            onStarted={(terminalId) => {
              select({ workspaceId, terminalId });
              refreshSessions();
            }}
          />
        ) : null}

        <Button
          variant="ghost"
          className="!h-6 !rounded-md px-1.5"
          aria-label="Open full screen"
          disabled={!activeWorktree}
          onClick={() => {
            if (!activeWorktree) return;
            setMode("closed");
            router.push(
              `/${channel.orgSlug}/${channel.channelSlug}/thread/${activeWorktree.threadId}/session`,
            );
          }}
        >
          <Maximize2 size={14} />
        </Button>
        <Button
          variant="ghost"
          className="!h-6 !rounded-md px-1.5"
          aria-label="Close agent panel"
          onClick={() => setMode("closed")}
        >
          <X size={14} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 bg-[#0a0a0a]">
        {workspaceId && activeTerminalId ? (
          <TerminalView
            key={activeTerminalId}
            orgSlug={channel.orgSlug}
            projectId={projectId}
            workspaceId={workspaceId}
            terminalId={activeTerminalId}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-xs">
              {worktrees?.length
                ? "No agents in this thread’s worktree — start one with +"
                : "No worktrees yet. One appears when an agent replies in a thread."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
