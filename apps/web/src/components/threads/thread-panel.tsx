"use client";

import type { ThreadDetail } from "@roster/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { Composer } from "~/components/messages/composer";
import { MessageRow } from "~/components/messages/message-row";
import { useNow } from "~/hooks/use-now";
import { useThreadRealtime } from "~/hooks/use-thread-realtime";
import type { MessageItem } from "~/types";
import { optimisticMessage } from "~/utils/message-cache";
import { startsNewGroup } from "~/utils/message-groups";
import { elapsedLabel } from "~/utils/relative-time";
import {
  addReply,
  failReply,
  mergeReply,
  splitThread,
} from "~/utils/thread-detail";
import { canRetry, isActive, threadDetailKey } from "~/utils/thread-rows";
import { trpc } from "~/utils/trpc";

import { ReplyDivider } from "./reply-divider";
import { ThreadCancel } from "./thread-cancel";
import { ThreadRetry } from "./thread-retry";
import { ThreadStatus } from "./thread-status";
import { WaitingOnCard } from "./waiting-on";

export interface ThreadPanelProps {
  projectId: string;
  threadId: string;
  authorName: string;
  authorEmail: string;
  initialDetail: ThreadDetail;
}

export function ThreadPanel({
  projectId,
  threadId,
  authorName,
  authorEmail,
  initialDetail,
}: ThreadPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = threadDetailKey(threadId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: detail } = useQuery({
    queryKey,
    queryFn: () => trpc.threads.get.query({ projectId, threadId }),
    initialData: initialDetail,
  });

  useThreadRealtime(threadId, projectId);

  const live = isActive(detail.thread.status);
  const now = useNow(live);
  const retryable = canRetry(detail.thread.status, detail.thread.error);
  const { root, replies } = splitThread(detail);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [detail]);

  async function send(payload: { body: unknown; text: string }) {
    const clientId = crypto.randomUUID();
    const optimistic: MessageItem = {
      ...optimisticMessage({
        projectId,
        clientId,
        body: payload.body,
        text: payload.text,
        authorName,
        authorEmail,
      }),
      threadId,
      parentMessageId: detail.thread.rootMessageId,
    };

    queryClient.setQueryData<ThreadDetail>(queryKey, (previous) =>
      previous ? addReply(previous, optimistic) : previous,
    );

    try {
      const saved = await trpc.messages.send.mutate({
        projectId,
        body: payload.body,
        text: payload.text,
        clientId,
        threadId,
      });
      queryClient.setQueryData<ThreadDetail>(queryKey, (previous) =>
        previous ? mergeReply(previous, saved as MessageItem) : previous,
      );
    } catch {
      queryClient.setQueryData<ThreadDetail>(queryKey, (previous) =>
        previous ? failReply(previous, clientId) : previous,
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="overscroll-contain flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="flex w-full flex-col pb-3">
          {root ? <MessageRow message={root} leading /> : null}

          <ReplyDivider count={replies.length} />

          {replies.map((message, index) => (
            <MessageRow
              key={message.clientId ?? message.id}
              message={message}
              leading={startsNewGroup(message, replies[index - 1])}
            />
          ))}

          {live ? (
            <div className="border-border mx-3 mt-2 flex flex-col gap-1 rounded-md border px-2.5 py-2 sm:mx-5">
              <span className="flex items-center gap-2">
                <ThreadStatus status={detail.thread.status} />
                <span
                  className="text-muted-foreground text-xs"
                  suppressHydrationWarning
                >
                  {elapsedLabel(new Date(detail.thread.startedAt), now)}
                </span>
              </span>
              {detail.thread.error ? (
                <span className="text-destructive text-sm">
                  {detail.thread.error}
                </span>
              ) : detail.thread.waitingOn ? (
                <WaitingOnCard waiting={detail.thread.waitingOn} />
              ) : detail.thread.lastProgress ? (
                <span className="text-muted-foreground text-sm">
                  {detail.thread.lastProgress}
                </span>
              ) : null}
              <span className="mt-0.5 flex items-center gap-1.5">
                <ThreadCancel projectId={projectId} threadId={threadId} />
                {retryable ? (
                  <ThreadRetry projectId={projectId} threadId={threadId} />
                ) : null}
              </span>
            </div>
          ) : detail.thread.error || retryable ? (
            <div className="border-border mx-3 mt-2 flex flex-col gap-1 rounded-md border px-2.5 py-2 sm:mx-5">
              {detail.thread.error ? (
                <span className="text-destructive text-sm">
                  {detail.thread.error}
                </span>
              ) : null}
              {retryable ? (
                <ThreadRetry projectId={projectId} threadId={threadId} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pb-safe-2 shrink-0 px-2 sm:px-3 sm:pb-3">
        <Composer placeholder="Reply…" onSend={send} />
      </div>
    </div>
  );
}
