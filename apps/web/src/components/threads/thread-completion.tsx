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
  DropdownMenuItem,
} from "@roster/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Loader2 } from "lucide-react";
import { useState } from "react";

import { liveThreadsKey } from "~/utils/live-threads";
import { channelMessagesKey } from "~/utils/message-cache";
import { toast } from "~/utils/toast-store";
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
  start: () => void;
  confirm: () => void;
  setConfirming: (open: boolean) => void;
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
  const [done, setDone] = useState(false);

  const completed = completedAt !== null || done;
  const live = isActive(status, completedAt);

  function complete() {
    if (pending) return;
    setConfirming(false);
    setPending(true);
    const note = toast.loading("Completing thread…");

    void (async () => {
      try {
        const fresh = await trpc.threads.complete.mutate({
          projectId,
          threadId,
        });
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
        setDone(true);
        note.success("Thread completed");
        // The mutation already handed back the completed thread, so the tick
        // lands now and the other views catch up in the background.
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: liveThreadsKey() }),
          queryClient.invalidateQueries({
            queryKey: channelMessagesKey(projectId),
          }),
          queryClient.invalidateQueries({ queryKey: threadDetailKey(threadId) }),
        ]).catch(() => undefined);
      } catch (cause) {
        note.error(
          "Could not complete that thread",
          errorMessage(cause, "That thread is still open."),
        );
      } finally {
        setPending(false);
      }
    })();
  }

  function start() {
    if (live) setConfirming(true);
    else complete();
  }

  return {
    completed,
    live,
    pending,
    confirming,
    start,
    confirm: complete,
    setConfirming,
  };
}

export function ThreadCompleteMenuItem({
  completion,
  closeMenu,
}: {
  completion: ThreadCompletion;
  closeMenu: () => void;
}) {
  if (completion.completed) {
    return (
      <DropdownMenuItem disabled className="gap-2">
        <CircleCheck size={14} />
        Completed
      </DropdownMenuItem>
    );
  }

  if (completion.pending) {
    return (
      <DropdownMenuItem disabled className="gap-2">
        <Loader2 size={14} className="animate-spin" />
        Completing…
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      className="gap-2"
      onSelect={(event) => {
        event.preventDefault();
        closeMenu();
        completion.start();
      }}
    >
      <CircleCheck size={14} />
      Mark as complete
    </DropdownMenuItem>
  );
}

export function ThreadCompleteDialogs({
  completion,
}: {
  completion: ThreadCompletion;
}) {
  return (
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
          <AlertDialogCancel>Leave it running</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-100 text-red-500 hover:bg-red-200"
            onClick={(event) => {
              event.preventDefault();
              completion.confirm();
            }}
          >
            Stop it and complete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
