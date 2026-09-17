"use client";

import { cn } from "@roster/ui";

import { isLive, isWaiting, statusLabel } from "~/utils/thread-rows";

export interface ThreadStatusProps {
  status: string;
}

const TONE: Record<string, string> = {
  starting: "bg-muted-foreground",
  running: "bg-primary",
  // Parked on another agent, not dead — pulses like a live thread.
  waiting: "bg-primary/60",
  completed: "bg-muted-foreground",
  failed: "bg-destructive",
  canceled: "bg-muted-foreground",
};

export function ThreadStatus({ status }: ThreadStatusProps) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          TONE[status] ?? "bg-muted-foreground",
          (isLive(status) || isWaiting(status)) && "animate-pulse",
        )}
      />
      <span className="text-muted-foreground text-xs">
        {statusLabel(status)}
      </span>
    </span>
  );
}
