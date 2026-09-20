"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useChannelRealtime } from "~/hooks/use-channel-realtime";
import type { MessageItem } from "~/types";
import {
  removeThread,
  type ThreadItem,
  threadsKey,
} from "~/utils/thread-rows";
import {
  channelMessagesKey,
  markFailed,
  mergeMessage,
  optimisticMessage,
  removeMessage,
  sortMessages,
} from "~/utils/message-cache";
import { trpc } from "~/utils/trpc";

import { WatchResumeOffer } from "~/components/channels/watch-resume-offer";

import { Composer, type ComposerSendPayload } from "./composer";
import { MessageList } from "./message-list";

export interface MessagePanelProps {
  projectId: string;
  channelName: string;
  basePath: string;
  memberId: string;
  authorName: string;
  authorEmail: string;
  initialMessages: MessageItem[];
  initialThreads: ThreadItem[];
  pausedCount: number;
}

export function MessagePanel({
  projectId,
  channelName,
  basePath,
  memberId,
  authorName,
  authorEmail,
  initialMessages,
  initialThreads,
  pausedCount,
}: MessagePanelProps) {
  const queryClient = useQueryClient();
  const queryKey = channelMessagesKey(projectId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const openThreadId = useSearchParams().get("thread");

  const { data: messages } = useQuery({
    queryKey,
    queryFn: () => trpc.messages.list.query({ projectId, limit: 50 }),
    initialData: initialMessages,
  });

  const { data: threads } = useQuery({
    queryKey: threadsKey(projectId),
    queryFn: () => trpc.threads.list.query({ projectId }),
    initialData: initialThreads,
  });

  useChannelRealtime(projectId);

  const threadsByRootMessage = new Map(
    threads.map((thread) => [thread.rootMessageId, thread]),
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  async function send(payload: ComposerSendPayload) {
    const clientId = crypto.randomUUID();
    const optimistic = optimisticMessage({
      projectId,
      clientId,
      body: payload.body,
      text: payload.text,
      authorName,
      authorEmail,
      attachments: payload.attachments,
    });

    queryClient.setQueryData<MessageItem[]>(queryKey, (previous) =>
      sortMessages([...(previous ?? []), optimistic]),
    );

    try {
      const saved = await trpc.messages.send.mutate({
        projectId,
        body: payload.body,
        text: payload.text,
        clientId,
        attachmentIds: payload.attachmentIds,
      });
      queryClient.setQueryData<MessageItem[]>(queryKey, (previous) =>
        mergeMessage(previous ?? [], saved),
      );
    } catch {
      queryClient.setQueryData<MessageItem[]>(queryKey, (previous) =>
        markFailed(previous ?? [], clientId),
      );
    }
  }

  async function remove(messageId: string) {
    const thread = threads.find((item) => item.rootMessageId === messageId);

    queryClient.setQueryData<MessageItem[]>(queryKey, (previous) =>
      removeMessage(previous ?? [], messageId),
    );
    if (thread) {
      queryClient.setQueryData<ThreadItem[]>(threadsKey(projectId), (previous) =>
        removeThread(previous ?? [], thread.id),
      );
      if (openThreadId === thread.id) router.replace(basePath);
    }

    try {
      await trpc.messages.remove.mutate({ projectId, messageId });
    } catch {
      console.warn("[messages] delete failed");
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: threadsKey(projectId) });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="overscroll-contain flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <div className="mt-auto w-full">
          <MessageList
            channelName={channelName}
            messages={messages}
            threadsByRootMessage={threadsByRootMessage}
            basePath={basePath}
            memberId={memberId}
            onDelete={remove}
          />
        </div>
      </div>
      <div className="pb-safe-2 shrink-0 px-2 sm:px-4 sm:pb-4">
        {pausedCount > 0 ? (
          <WatchResumeOffer projectId={projectId} count={pausedCount} />
        ) : null}
        <Composer
          placeholder={`Message #${channelName}`}
          projectId={projectId}
          onSend={send}
        />
      </div>
    </div>
  );
}
