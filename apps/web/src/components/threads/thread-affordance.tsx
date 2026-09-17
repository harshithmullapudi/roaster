"use client";

import Link from "next/link";

import { useNow } from "~/hooks/use-now";
import { relativeTime } from "~/utils/relative-time";
import { isLive, replyCountLabel, type ThreadItem } from "~/utils/thread-rows";

import { ReplyAvatars } from "./reply-avatars";
import { ThreadStatus } from "./thread-status";

export interface ThreadAffordanceProps {
  thread: ThreadItem;
  href: string;
}

export function ThreadAffordance({ thread, href }: ThreadAffordanceProps) {
  const live = isLive(thread.status);
  const now = useNow(live);

  return (
    <Link
      href={href}
      className="hover:bg-grayAlpha-50 hover:border-border -ml-1 mt-1 flex w-full max-w-2xl items-center gap-2 rounded-md border border-transparent px-1 py-1"
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
    </Link>
  );
}
