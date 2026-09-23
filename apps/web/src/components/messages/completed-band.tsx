"use client";

import { cn } from "@roster/ui";
import { ChevronDown } from "lucide-react";
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
    <div className="group/band relative px-3 py-1.5 sm:px-5">
      <span
        aria-hidden
        className="border-border/60 absolute inset-x-3 top-1/2 border-t sm:inset-x-5"
      />
      <span className="relative flex justify-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="bg-background-2 text-muted-foreground/70 group-hover/band:text-muted-foreground flex items-center gap-1 px-2 text-[11px]"
        >
          <span suppressHydrationWarning>
            {`${bandLabel(count)} · ${relativeTime(lastAt)}`}
          </span>
          <ChevronDown
            size={11}
            className={cn("shrink-0 opacity-40", expanded && "rotate-180")}
          />
        </button>
      </span>
    </div>
  );
});
