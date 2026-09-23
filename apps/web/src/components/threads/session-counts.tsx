"use client";

import { cn } from "@roster/ui";

export interface SessionCountsProps {
  running: number;
  needsInput: number;
  turnDone: number;
  labeled?: boolean;
  className?: string;
}

/*
 * Three counts, never summed. A session waiting on a person is the one you can
 * actually act on, so it keeps its own amber dot rather than being folded into
 * "running" — and it is still, because the pulse means work is happening. A
 * finished turn nobody has read yet is still again, in green.
 */
export function SessionCounts({
  running,
  needsInput,
  turnDone,
  labeled = false,
  className,
}: SessionCountsProps) {
  if (running <= 0 && needsInput <= 0 && turnDone <= 0) return null;

  return (
    <span className={cn("flex shrink-0 items-center gap-2 text-xs", className)}>
      {running > 0 ? (
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-blue-500" />
          {labeled ? `${running} running` : running}
        </span>
      ) : null}
      {needsInput > 0 ? (
        <span className="flex items-center gap-1.5">
          <span className="bg-warning size-1.5 rounded-full" />
          {labeled ? `${needsInput} needs input` : needsInput}
        </span>
      ) : null}
      {turnDone > 0 ? (
        <span className="flex items-center gap-1.5">
          <span className="bg-success size-1.5 rounded-full" />
          {labeled ? `${turnDone} done` : turnDone}
        </span>
      ) : null}
    </span>
  );
}
