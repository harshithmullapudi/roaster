"use client";

import type { NotificationItem } from "@roster/api";
import { cn } from "@roster/ui";
import {
  AtSign,
  Bot,
  Clock,
  Forward,
  Hash,
  Reply,
  TriangleAlert,
} from "lucide-react";

import {
  notificationLabel,
  type NotificationType,
} from "~/utils/notification-cache";
import { relativeTime } from "~/utils/relative-time";

const ICONS: Record<NotificationType, typeof Bot> = {
  agent_replied: Bot,
  agent_waiting: Clock,
  agent_failed: TriangleAlert,
  human_replied: Reply,
  mentioned: AtSign,
  delegation_received: Forward,
};

export interface NotificationRowProps {
  item: NotificationItem;
  now: Date;
  onOpen: (item: NotificationItem) => void;
}

export function NotificationRow({ item, now, onOpen }: NotificationRowProps) {
  const Icon = ICONS[item.type] ?? Bot;
  const unread = item.readAt === null;
  const title = item.rootText.split("\n")[0]?.trim();

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "hover:bg-grayAlpha-100 flex w-full items-start gap-2 rounded px-2 py-2 text-left",
        unread && "bg-grayAlpha-100/60",
      )}
    >
      <Icon
        size={15}
        className={cn(
          "mt-0.5 shrink-0",
          item.type === "agent_failed" ? "text-red-500" : "text-muted-foreground",
        )}
      />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "min-w-0 truncate text-xs",
              unread ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {item.actorDisplay
              ? `${item.actorDisplay} · ${notificationLabel(item.type)}`
              : notificationLabel(item.type)}
          </span>
          <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
            {relativeTime(item.createdAt, now)}
          </span>
        </span>

        <span className="text-foreground line-clamp-2 text-xs">
          {item.preview || title || "No preview"}
        </span>

        <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-[11px]">
          <Hash size={11} className="shrink-0" />
          <span className="shrink-0">{item.channelName}</span>
          {title ? <span className="min-w-0 truncate">· {title}</span> : null}
        </span>
      </span>

      {unread ? (
        <span
          aria-label="Unread"
          className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full"
        />
      ) : null}
    </button>
  );
}
