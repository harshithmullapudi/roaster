"use client";

import Link from "next/link";

import { displayName } from "~/utils/message-groups";
import { elapsedLabel } from "~/utils/relative-time";
import { isLive, type ThreadItem } from "~/utils/thread-rows";

import { SessionStatusIcon } from "./session-status";

export interface SessionRowProps {
  thread: ThreadItem;
  href: string;
  now: Date;
  showAuthor?: boolean;
}

export function SessionRow({
  thread,
  href,
  now,
  showAuthor = true,
}: SessionRowProps) {
  const live = isLive(thread.status);
  const detail = thread.error ?? thread.lastProgress;

  return (
    <Link
      href={href}
      className="group hover:bg-accent/50 mx-2 flex items-center gap-2 rounded-lg px-2 py-2"
    >
      <SessionStatusIcon status={thread.status} />
      <span className="min-w-0 flex-1 truncate text-sm">
        {thread.rootText || "Untitled session"}
        {detail ? (
          <span className="text-muted-foreground"> — {detail}</span>
        ) : null}
      </span>
      {showAuthor && (
        <span className="text-muted-foreground hidden max-w-40 shrink-0 truncate text-xs sm:block">
          {displayName(thread.authorName, thread.authorEmail)}
        </span>
      )}
      <span
        className="text-muted-foreground w-16 shrink-0 text-right text-xs"
        suppressHydrationWarning
      >
        {elapsedLabel(thread.startedAt, live ? now : thread.endedAt)}
      </span>
    </Link>
  );
}
