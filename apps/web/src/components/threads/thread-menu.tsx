"use client";

import type { ThreadDetail } from "@roster/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@roster/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { liveThreadsKey } from "~/utils/live-threads";
import {
  isActive,
  mergeThread,
  type ThreadItem,
  threadDetailKey,
  threadsKey,
} from "~/utils/thread-rows";
import { errorMessage, trpc } from "~/utils/trpc";

export interface ThreadMenuProps {
  projectId: string;
  threadId: string;
  status: string;
  completedAt: Date | null;
  className?: string;
}

export function ThreadMenu({
  projectId,
  threadId,
  status,
  completedAt,
  className,
}: ThreadMenuProps) {
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const completed = completedAt !== null || done;
  const live = isActive(status, completedAt);

  async function complete() {
    setPending(true);
    try {
      const fresh = await trpc.threads.complete.mutate({ projectId, threadId });
      if (fresh) {
        queryClient.setQueryData<ThreadDetail>(
          threadDetailKey(threadId),
          (previous) => (previous ? { ...previous, thread: fresh } : previous),
        );
        queryClient.setQueryData<ThreadItem[]>(
          threadsKey(projectId),
          (previous) => (previous ? mergeThread(previous, fresh) : previous),
        );
      }
      await queryClient.invalidateQueries({ queryKey: liveThreadsKey() });
      setDone(true);
      setConfirming(false);
    } catch (cause) {
      setConfirming(false);
      setError(errorMessage(cause, "Could not complete that thread."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Thread actions"
            className={cn("text-muted-foreground !rounded-md", className)}
          >
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {completed ? (
            <DropdownMenuItem disabled className="gap-2">
              <CircleCheck size={14} />
              Completed
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="gap-2"
              onSelect={(event) => {
                event.preventDefault();
                setMenuOpen(false);
                if (live) setConfirming(true);
                else void complete();
              }}
            >
              <CircleCheck size={14} />
              Mark as complete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this thread complete?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent is still running. Completing the thread stops it and
              deletes its worktree from the machine — any work in there that has
              not been pushed is gone. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              Leave it running
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-100 text-red-500 hover:bg-red-200"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void complete();
              }}
            >
              {pending ? "Completing…" : "Stop it and complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={error !== null}
        onOpenChange={(open) => {
          if (!open) setError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>That thread is still open</AlertDialogTitle>
            <AlertDialogDescription>{error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setError(null)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
