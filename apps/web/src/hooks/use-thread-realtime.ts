"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Centrifuge } from "centrifuge";
import { useEffect } from "react";

import type { ThreadDetail } from "@roster/api";

import type { MessageItem } from "~/types";
import {
  applyReactionToCaches,
  parsePublishedMessage,
  parsePublishedReaction,
} from "~/utils/message-cache";
import { mergeDetail, mergeReply } from "~/utils/thread-detail";
import { parsePublishedThread, threadDetailKey } from "~/utils/thread-rows";
import { trpc } from "~/utils/trpc";

export function useThreadRealtime(threadId: string, projectId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let centrifuge: Centrifuge | null = null;
    const queryKey = threadDetailKey(threadId);

    async function refetch() {
      try {
        const fresh = await trpc.threads.get.query({ projectId, threadId });
        if (disposed) return;
        queryClient.setQueryData<ThreadDetail>(queryKey, (previous) =>
          previous ? mergeDetail(previous, fresh) : fresh,
        );
      } catch {
        console.warn("[realtime] thread refetch failed");
      }
    }

    async function start() {
      let connection;
      try {
        connection = await trpc.realtime.connectionToken.query();
      } catch {
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

      let subscription;
      try {
        const authorized = await trpc.realtime.threadSubscriptionToken.query({
          threadId,
        });
        if (disposed || !authorized.enabled) return;

        subscription = instance.newSubscription(authorized.channel, {
          token: authorized.token,
          getToken: async () => {
            const next = await trpc.realtime.threadSubscriptionToken.query({
              threadId,
            });
            if (!next.enabled) throw new Error("Realtime is disabled.");
            return next.token;
          },
        });
      } catch {
        console.warn("[realtime] thread not authorized, staying on trpc only");
        return;
      }

      subscription.on("publication", (ctx) => {
        const message = parsePublishedMessage(ctx.data);
        if (message) {
          if (message.threadId !== threadId) return;
          queryClient.setQueryData<ThreadDetail>(queryKey, (previous) =>
            previous ? mergeReply(previous, message as MessageItem) : previous,
          );
          return;
        }

        const reaction = parsePublishedReaction(ctx.data);
        if (reaction) {
          if (reaction.threadId !== threadId) return;
          applyReactionToCaches(queryClient, reaction);
          return;
        }

        const thread = parsePublishedThread(ctx.data);
        if (!thread || thread.id !== threadId) return;
        queryClient.setQueryData(queryKey, (previous: unknown) => {
          if (typeof previous !== "object" || previous === null) return previous;
          const detail = previous as { thread: unknown; messages: unknown };
          return { ...detail, thread: { ...(detail.thread as object), ...thread } };
        });
        if (thread.status === "completed" || thread.status === "failed") {
          void refetch();
        }
      });

      subscription.on("subscribed", () => {
        void refetch();
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
  }, [threadId, projectId, queryClient]);
}
