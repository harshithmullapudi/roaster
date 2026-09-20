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
} from "@roster/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { liveThreadsKey } from "~/utils/live-threads";
import { channelMessagesKey } from "~/utils/message-cache";
import {
  isActive,
  mergeThread,
  type ThreadItem,
  threadDetailKey,
  threadsKey,
} from "~/utils/thread-rows";
import { errorMessage, trpc } from "~/utils/trpc";

export interface ThreadCompletionArgs {
  projectId: string;
  threadId: string;
  status: string;
  completedAt: Date | null;
}

export interface ThreadCompletion {
  completed: boolean;
  live: boolean;
  pending: boolean;
  confirming: boolean;
  error: string | null;
  start: () => void;
  complete: () => Promise<void>;
  setConfirming: (open: boolean) => void;
  setError: (message: string | null) => void;
}

export function useThreadCompletion({
  projectId,
  threadId,
  status,
  completedAt,
}: ThreadCompletionArgs): ThreadCompletion {
  const queryClient = useQueryClient();
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: liveThreadsKey() }),
        queryClient.invalidateQueries({
          queryKey: channelMessagesKey(projectId),
        }),
        queryClient.invalidateQueries({ queryKey: threadDetailKey(threadId) }),
      ]);
      setDone(true);
      setConfirming(false);
    } catch (cause) {
      setConfirming(false);
      setError(errorMessage(cause, "Could not complete that thread."));
    } finally {
      setPending(false);
    }
  }

  function start() {
    if (live) setConfirming(true);
    else void complete();
  }

  return {
    completed,
    live,
    pending,
    confirming,
    error,
    start,
    complete,
    setConfirming,
    setError,
  };
}

export function ThreadCompleteDialogs({
  completion,
}: {
  completion: ThreadCompletion;
}) {
  return (
    <>
      <AlertDialog
        open={completion.confirming}
        onOpenChange={completion.setConfirming}
      >
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
            <AlertDialogCancel disabled={completion.pending}>
              Leave it running
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-100 text-red-500 hover:bg-red-200"
              disabled={completion.pending}
              onClick={(event) => {
                event.preventDefault();
                void completion.complete();
              }}
            >
              {completion.pending ? "Completing…" : "Stop it and complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={completion.error !== null}
        onOpenChange={(open) => {
          if (!open) completion.setError(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>That thread is still open</AlertDialogTitle>
            <AlertDialogDescription>{completion.error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => completion.setError(null)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
