"use client";

import { cn } from "@roster/ui";

export interface RunningCountProps {
  count: number;
  labeled?: boolean;
  className?: string;
}

export function RunningCount({
  count,
  labeled = false,
  className,
}: RunningCountProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn("flex shrink-0 items-center gap-1.5 text-xs", className)}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-blue-500" />
      {labeled ? `${count} running` : count}
    </span>
  );
}
