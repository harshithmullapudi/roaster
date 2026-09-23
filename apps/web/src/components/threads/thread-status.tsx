"use client";

import { cn } from "@roster/ui";

import { isLive, isWaiting, statusLabel, statusTone } from "~/utils/thread-rows";

export interface StatusPipProps {
  tone: string;
  label: string;
  pulse?: boolean;
  strong?: boolean;
}

export function StatusPip({ tone, label, pulse, strong }: StatusPipProps) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className={cn("size-1.5 rounded-full", tone, pulse && "animate-pulse")}
      />
      <span
        className={cn(
          "text-xs",
          strong ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export interface ThreadStatusProps {
  status: string;
  strong?: boolean;
}

export function ThreadStatus({ status, strong }: ThreadStatusProps) {
  return (
    <StatusPip
      tone={statusTone(status) ?? "bg-muted-foreground"}
      label={statusLabel(status)}
      strong={strong}
      // A pulse means work is happening. Needs input is deliberately
      // still — it is the colour that should catch the eye, not motion.
      pulse={isLive(status) || isWaiting(status)}
    />
  );
}

export function TurnCompleted() {
  return <StatusPip tone="bg-success" label="Turn completed" />;
}
