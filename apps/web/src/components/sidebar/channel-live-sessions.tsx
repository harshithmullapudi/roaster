"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
} from "@roster/ui";
import Link from "next/link";

import { SessionCounts } from "~/components/threads/session-counts";
import { ThreadStatus } from "~/components/threads/thread-status";
import {
  countByState,
  type LiveThreadItem,
  threadTitle,
} from "~/utils/live-threads";

export interface ChannelLiveSessionsProps {
  channelSlug: string;
  basePath: string;
  threads: LiveThreadItem[];
}

export function ChannelLiveSessions({
  channelSlug,
  basePath,
  threads,
}: ChannelLiveSessionsProps) {
  if (threads.length === 0) return null;

  const counts = countByState(threads);
  const heading =
    counts.needsInput > 0
      ? `${counts.needsInput} of ${threads.length} waiting on you`
      : threads.length === 1
        ? "1 session running"
        : `${threads.length} sessions running`;

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${heading} in ${channelSlug}`}
          className="text-muted-foreground hover:text-foreground min-w-(--btn-h-xs) flex h-(--btn-h-xs) shrink-0 items-center justify-end gap-1.5 px-0.5"
        >
          <SessionCounts
            running={counts.running}
            needsInput={counts.needsInput}
          />
        </button>
      </HoverCardTrigger>

      <HoverCardPortal>
        <HoverCardContent side="right" align="start" className="w-80">
          <p className="text-muted-foreground px-2 pb-1 pt-1.5 text-xs">
            {heading}
          </p>

          <div className="flex flex-col">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`${basePath}?thread=${thread.id}`}
                className="hover:bg-accent flex flex-col gap-0.5 rounded-md px-2 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {threadTitle(thread.rootText)}
                  </span>
                  <ThreadStatus status={thread.status} />
                </span>

                {thread.lastProgress ? (
                  <span className="text-muted-foreground truncate text-xs">
                    {thread.lastProgress}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}
