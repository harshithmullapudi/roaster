"use client";

import { cn } from "@roster/ui";

import { isLive, isWaiting, statusLabel, statusTone } from "~/utils/thread-rows";

export interface ThreadStatusProps {
  status: string;
}

export function ThreadStatus({ status }: ThreadStatusProps) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          statusTone(status) ?? "bg-muted-foreground",
          // A pulse means work is happening. Needs input is deliberately
          // still — it is the colour that should catch the eye, not motion.
          (isLive(status) || isWaiting(status)) && "animate-pulse",
        )}
      />
      <span className="text-muted-foreground text-xs">
        {statusLabel(status)}
      </span>
    </span>
  );
}
