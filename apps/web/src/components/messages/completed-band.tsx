"use client";

import { cn } from "@roster/ui";
import { ChevronDown, CircleCheck } from "lucide-react";
import { memo } from "react";

import { bandLabel } from "~/utils/channel-rows";
import { relativeTime } from "~/utils/relative-time";

export interface CompletedBandProps {
  count: number;
  lastAt: Date;
  expanded: boolean;
  onToggle: () => void;
}

export const CompletedBand = memo(function CompletedBand({
  count,
  lastAt,
  expanded,
  onToggle,
}: CompletedBandProps) {
  return (
    <div className="relative px-3 py-2.5 sm:px-5">
      <span
        aria-hidden
        className="border-border absolute inset-x-3 top-1/2 border-t sm:inset-x-5"
      />
      <span className="relative flex justify-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="bg-background-2 border-border text-muted-foreground hover:bg-background-3 hover:text-foreground flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
        >
          <CircleCheck size={13} className="shrink-0" />
          <span suppressHydrationWarning>
            {`${bandLabel(count)} · ${relativeTime(lastAt)}`}
          </span>
          <ChevronDown
            size={13}
            className={cn("shrink-0", expanded && "rotate-180")}
          />
        </button>
      </span>
    </div>
  );
});
