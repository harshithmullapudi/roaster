"use client";

import { SessionCounts } from "~/components/threads/session-counts";
import { SessionsHoverCard } from "~/components/threads/sessions-hover-card";
import {
  countByState,
  type LiveThreadItem,
  sessionsHeading,
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
  const heading = sessionsHeading(counts, threads.length);

  return (
    <SessionsHoverCard
      threads={threads}
      basePath={basePath}
      heading={heading}
      side="right"
      align="start"
    >
      <button
        type="button"
        aria-label={`${heading} in ${channelSlug}`}
        className="text-muted-foreground hover:text-foreground min-w-(--btn-h-xs) flex h-(--btn-h-xs) shrink-0 items-center justify-end gap-1.5 px-0.5"
      >
        <SessionCounts
          running={counts.running}
          needsInput={counts.needsInput}
          turnDone={counts.turnDone}
        />
      </button>
    </SessionsHoverCard>
  );
}
