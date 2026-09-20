"use client";

import type { NotificationItem } from "@roster/api";
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@roster/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useNow } from "~/hooks/use-now";
import {
  applyUnreadDelta,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsKey,
  threadHref,
  unreadBadge,
  unreadCount,
  unreadCountKey,
} from "~/utils/notification-cache";
import { trpc } from "~/utils/trpc";

import { NotificationRow } from "./notification-row";

export interface NotificationBellProps {
  orgSlug: string;
}

export function NotificationBell({ orgSlug }: NotificationBellProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const now = useNow(open, 30_000);

  const { data: serverCount } = useQuery({
    queryKey: unreadCountKey(),
    queryFn: () => trpc.notifications.unreadCount.query(),
    refetchInterval: 60_000,
  });

  const { data: items, isPending } = useQuery({
    queryKey: notificationsKey(),
    queryFn: () =>
      trpc.notifications.list.query({ limit: 30 }).then((page) => page.items),
    enabled: open,
  });

  const count = serverCount ?? unreadCount(items ?? []);
  const badge = unreadBadge(count);

  const reconcile = () => {
    void queryClient.invalidateQueries({ queryKey: unreadCountKey() });
  };

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      trpc.notifications.markRead.mutate({ notificationId }),
    onSettled: reconcile,
  });

  const markAll = useMutation({
    mutationFn: () => trpc.notifications.markAllRead.mutate(),
    onMutate: () => {
      queryClient.setQueryData<NotificationItem[]>(
        notificationsKey(),
        (previous) => (previous ? markAllNotificationsRead(previous) : previous),
      );
      queryClient.setQueryData<number>(unreadCountKey(), 0);
    },
    onSettled: reconcile,
  });

  const openRow = (item: NotificationItem) => {
    if (item.readAt === null) {
      queryClient.setQueryData<NotificationItem[]>(
        notificationsKey(),
        (previous) =>
          previous ? markNotificationRead(previous, item.id) : previous,
      );
      queryClient.setQueryData<number>(unreadCountKey(), (previous) =>
        applyUnreadDelta(previous, -1),
      );
      markRead.mutate(item.id);
    }

    setOpen(false);
    router.push(threadHref(orgSlug, item));
  };

  const rows = items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            count > 0 ? `Notifications, ${count} unread` : "Notifications"
          }
        >
          <Bell size={16} />
          {badge ? (
            <Badge className="absolute right-0 top-0 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
              {badge}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-88 max-w-[90vw] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground text-xs"
            disabled={count === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto p-1">
          {isPending && rows.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-xs">
              Loading notifications…
            </p>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-1.5 px-2 py-8 text-center">
              <Inbox size={18} />
              <p className="text-xs">You are all caught up.</p>
              <p className="text-[11px]">
                Replies, mentions and hand-offs land here.
              </p>
            </div>
          ) : (
            rows.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                now={now}
                onOpen={openRow}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
