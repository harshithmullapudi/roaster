"use client";

import Link from "next/link";

import { useNow } from "~/hooks/use-now";
import { relativeTime } from "~/utils/relative-time";
import {
  isActive,
  replyCountLabel,
  type ThreadItem,
} from "~/utils/thread-rows";

import { ReplyAvatars } from "./reply-avatars";
import { ThreadMenu } from "./thread-menu";
import { ThreadStatus } from "./thread-status";

export interface ThreadAffordanceProps {
  thread: ThreadItem;
  href: string;
}

export function ThreadAffordance({ thread, href }: ThreadAffordanceProps) {
  const live = isActive(thread.status, thread.completedAt);
  const now = useNow(live);

  return (
    <div className="group/thread relative -ml-1 mt-1 w-full max-w-2xl">
      <Link
        href={href}
        className="hover:bg-grayAlpha-50 hover:border-border flex w-full items-center gap-2 rounded-md border border-transparent py-1 pl-1 pr-8"
      >
        <ReplyAvatars names={thread.replierNames} />
        <span className="text-primary text-sm font-medium">
          {thread.replyCount > 0
            ? replyCountLabel(thread.replyCount)
            : "View thread"}
        </span>
        {thread.lastReplyAt ? (
          <span
            className="text-muted-foreground truncate text-xs"
            suppressHydrationWarning
          >
            {`Last reply ${relativeTime(thread.lastReplyAt, now)}`}
          </span>
        ) : null}
        {live ? <ThreadStatus status={thread.status} /> : null}
        {thread.waitingOn ? (
          <span className="text-muted-foreground truncate text-xs">
            {`on @${thread.waitingOn.handle}`}
          </span>
        ) : null}
      </Link>
      <ThreadMenu
        projectId={thread.projectId}
        threadId={thread.id}
        status={thread.status}
        completedAt={thread.completedAt}
        className="absolute right-0.5 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/thread:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
      />
    </div>
  );
}
