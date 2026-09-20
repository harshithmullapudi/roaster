"use client";

import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";

import { hasUnread, unreadCountKey } from "~/utils/notification-cache";
import { trpc } from "~/utils/trpc";

import { SidebarLink } from "./sidebar-link";

const REFRESH_MS = 60_000;

export interface ThreadsLinkProps {
  href: string;
  active: boolean;
}

export function ThreadsLink({ href, active }: ThreadsLinkProps) {
  const { data } = useQuery({
    queryKey: unreadCountKey(),
    queryFn: () => trpc.notifications.unreadCount.query(),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  return (
    <SidebarLink
      href={href}
      active={active}
      icon={<MessagesSquare size={14} />}
      label="Threads"
      trailing={
        hasUnread(data) ? (
          <span
            aria-label="Unread threads"
            className="bg-primary size-1.5 shrink-0 rounded-full"
          />
        ) : null
      }
    />
  );
}
