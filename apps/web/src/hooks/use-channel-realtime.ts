"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Centrifuge } from "centrifuge";
import { useEffect } from "react";

import type { MessageItem } from "~/types";
import {
  applyReactionToCaches,
  channelMessagesKey,
  mergeMessage,
  mergeMessages,
  parsePublishedDeletion,
  parsePublishedMessage,
  parsePublishedReaction,
  removeMessage,
} from "~/utils/message-cache";
import { speakerName } from "~/utils/message-groups";
import {
  countReply,
  mergeThread,
  parsePublishedThread,
  removeThread,
  type ThreadItem,
  threadsKey,
} from "~/utils/thread-rows";
import { trpc } from "~/utils/trpc";

const countedReplies = new Set<string>();

export function useChannelRealtime(projectId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let centrifuge: Centrifuge | null = null;
    const queryKey = channelMessagesKey(projectId);

    async function backfill(reason: string) {
      try {
        const [fresh, threads] = await Promise.all([
          trpc.messages.list.query({ projectId, limit: 50 }),
          trpc.threads.list.query({ projectId }).catch(() => null),
        ]);
        if (disposed) return;
        queryClient.setQueryData<MessageItem[]>(queryKey, (previous) =>
          mergeMessages(previous ?? [], fresh),
        );
        if (threads) queryClient.setQueryData(threadsKey(projectId), threads);
        console.info(`[realtime] rest backfill (${reason})`);
      } catch {
        console.warn("[realtime] rest backfill failed");
      }
    }

    async function start() {
      let connection;
      try {
        connection = await trpc.realtime.connectionToken.query();
      } catch {
        console.warn("[realtime] no connection token, staying on trpc only");
        return;
      }
      if (disposed || !connection.enabled) return;

      const instance = new Centrifuge(connection.url, {
        token: connection.token,
        getToken: async () => {
          const next = await trpc.realtime.connectionToken.query();
          if (!next.enabled) throw new Error("Realtime is disabled.");
          return next.token;
        },
      });
      centrifuge = instance;

      instance.on("error", (ctx) => {
        console.warn(`[realtime] connection error: ${ctx.error.message}`);
      });

      let subscription;
      try {
        const authorized = await trpc.realtime.subscriptionToken.query({
          projectId,
        });
        if (disposed || !authorized.enabled) return;

        subscription = instance.newSubscription(authorized.channel, {
          token: authorized.token,
          getToken: async () => {
            const next = await trpc.realtime.subscriptionToken.query({
              projectId,
            });
            if (!next.enabled) throw new Error("Realtime is disabled.");
            return next.token;
          },
        });
      } catch {
        console.warn("[realtime] channel not authorized, staying on trpc only");
        return;
      }

      subscription.on("publication", (ctx) => {
        const deletion = parsePublishedDeletion(ctx.data);
        if (deletion && deletion.projectId === projectId) {
          queryClient.setQueryData<MessageItem[]>(queryKey, (previous) =>
            removeMessage(previous ?? [], deletion.messageId),
          );
          if (deletion.threadId) {
            const threadId = deletion.threadId;
            queryClient.setQueryData<ThreadItem[]>(
              threadsKey(projectId),
              (previous) => removeThread(previous ?? [], threadId),
            );
          }
          return;
        }

        const reaction = parsePublishedReaction(ctx.data);
        if (reaction && reaction.projectId === projectId) {
          applyReactionToCaches(queryClient, reaction);
          return;
        }

        const thread = parsePublishedThread(ctx.data);
        if (thread && thread.projectId === projectId) {
          queryClient.setQueryData<ThreadItem[]>(
            threadsKey(projectId),
            (previous) => mergeThread(previous ?? [], thread),
          );
          return;
        }

        const message = parsePublishedMessage(ctx.data);
        if (!message || message.projectId !== projectId) return;

        if (message.parentMessageId && message.threadId) {
          if (countedReplies.has(message.id)) return;
          countedReplies.add(message.id);
          const threadId = message.threadId;
          queryClient.setQueryData<ThreadItem[]>(
            threadsKey(projectId),
            (previous) =>
              countReply(previous ?? [], {
                threadId,
                createdAt: message.createdAt,
                replierName: speakerName(message),
              }),
          );
          return;
        }

        queryClient.setQueryData<MessageItem[]>(queryKey, (previous) =>
          mergeMessage(previous ?? [], message),
        );
      });

      subscription.on("subscribed", (ctx) => {
        if (ctx.recovered) {
          console.info("[realtime] centrifugo recovery replayed history");
          return;
        }
        void backfill(ctx.wasRecovering ? "recovery failed" : "first subscribe");
      });

      subscription.on("error", (ctx) => {
        console.warn(`[realtime] subscription error: ${ctx.error.message}`);
      });

      subscription.subscribe();
      instance.connect();
    }

    void start();

    return () => {
      disposed = true;
      centrifuge?.disconnect();
      centrifuge = null;
    };
  }, [projectId, queryClient]);
}
