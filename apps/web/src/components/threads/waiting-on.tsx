"use client";

import type { WaitingOn } from "@roster/api";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ThreadStatus } from "./thread-status";

export interface WaitingOnCardProps {
  waiting: WaitingOn;
}

/**
 * What the agent this thread asked is doing right now.
 *
 * A parked thread has nothing of its own to say, and a bare "Waiting" reads as
 * a session that died. The answering agent's live status and last line make it
 * plain that work is still moving — one channel over.
 */
export function WaitingOnCard({ waiting }: WaitingOnCardProps) {
  const params = useParams<{ slug: string }>();
  const href =
    params?.slug && waiting.threadId
      ? `/${params.slug}/${waiting.channelSlug}/thread/${waiting.threadId}`
      : null;

  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className="text-xs font-medium">@{waiting.handle}</span>
        <ThreadStatus status={waiting.status} />
      </span>
      <span className="text-muted-foreground line-clamp-2 text-xs">
        {waiting.lastProgress ?? waiting.task}
      </span>
    </>
  );

  if (!href) {
    return (
      <span className="border-border flex flex-col gap-0.5 rounded-md border border-dashed px-2 py-1.5">
        {body}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="border-border hover:bg-accent/50 flex flex-col gap-0.5 rounded-md border border-dashed px-2 py-1.5"
    >
      {body}
    </Link>
  );
}
