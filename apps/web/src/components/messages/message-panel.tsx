"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useChannelRealtime } from "~/hooks/use-channel-realtime";
import type { MessageItem } from "~/types";
import { type ThreadItem, threadsKey } from "~/utils/thread-rows";
import {
  channelMessagesKey,
  markFailed,
  mergeMessage,
  optimisticMessage,
  sortMessages,
} from "~/utils/message-cache";
import { trpc } from "~/utils/trpc";

import { WatchResumeOffer } from "~/components/channels/watch-resume-offer";

import { Composer } from "./composer";
import { MessageList } from "./message-list";

export interface MessagePanelProps {
  projectId: string;
  channelName: string;
  basePath: string;
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
  authorName,
  authorEmail,
  initialMessages,
  initialThreads,
  pausedCount,
}: MessagePanelProps) {
  const queryClient = useQueryClient();
  const queryKey = channelMessagesKey(projectId);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  async function send(payload: { body: unknown; text: string }) {
    const clientId = crypto.randomUUID();
    const optimistic = optimisticMessage({
      projectId,
      clientId,
      body: payload.body,
      text: payload.text,
      authorName,
      authorEmail,
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
          />
        </div>
      </div>
      <div className="pb-safe-2 shrink-0 px-2 sm:px-4 sm:pb-4">
        {pausedCount > 0 ? (
          <WatchResumeOffer projectId={projectId} count={pausedCount} />
        ) : null}
        <Composer placeholder={`Message #${channelName}`} onSend={send} />
      </div>
    </div>
  );
}
