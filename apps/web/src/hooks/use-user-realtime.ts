"use client";

import type { NotificationItem } from "@roster/api";
import { useQueryClient } from "@tanstack/react-query";
import { Centrifuge } from "centrifuge";
import { useEffect } from "react";

import {
  applyUnreadDelta,
  notificationsKey,
  parsePublishedNotification,
  prependNotification,
  unreadCountKey,
} from "~/utils/notification-cache";
import { trpc } from "~/utils/trpc";

export function useUserRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let centrifuge: Centrifuge | null = null;

    async function backfill(reason: string) {
      const cached = queryClient.getQueryData<NotificationItem[]>(
        notificationsKey(),
      );

      try {
        const [unread, page] = await Promise.all([
          trpc.notifications.unreadCount.query(),
          cached
            ? trpc.notifications.list.query({ limit: 30 })
            : Promise.resolve(null),
        ]);
        if (disposed) return;

        queryClient.setQueryData<number>(unreadCountKey(), unread);
        if (page) {
          queryClient.setQueryData<NotificationItem[]>(
            notificationsKey(),
            page.items,
          );
        }
        console.info(`[realtime] notification backfill (${reason})`);
      } catch {
        console.warn("[realtime] notification backfill failed");
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
        const authorized = await trpc.realtime.userSubscriptionToken.query();
        if (disposed || !authorized.enabled) return;

        subscription = instance.newSubscription(authorized.channel, {
          token: authorized.token,
          getToken: async () => {
            const next = await trpc.realtime.userSubscriptionToken.query();
            if (!next.enabled) throw new Error("Realtime is disabled.");
            return next.token;
          },
        });
      } catch {
        console.warn("[realtime] inbox not authorized, staying on trpc only");
        return;
      }

      subscription.on("publication", (ctx) => {
        const notification = parsePublishedNotification(ctx.data);
        if (!notification) return;

        const cached = queryClient.getQueryData<NotificationItem[]>(
          notificationsKey(),
        );
        if (cached?.some((one) => one.id === notification.id)) return;

        if (cached) {
          queryClient.setQueryData<NotificationItem[]>(
            notificationsKey(),
            prependNotification(cached, notification),
          );
        }

        queryClient.setQueryData<number>(unreadCountKey(), (previous) =>
          applyUnreadDelta(previous, 1),
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
  }, [queryClient]);
}
