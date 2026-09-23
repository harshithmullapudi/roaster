"use client";

import { cn } from "@roster/ui";
import { ChevronDown, ChevronRight, CircleCheck } from "lucide-react";
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
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className={cn("px-3 sm:px-5", expanded ? "pt-3 pb-1" : "py-1.5")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="text-muted-foreground hover:bg-grayAlpha-50 hover:text-foreground hover:border-border flex w-full items-center gap-2 rounded-md border border-transparent px-1 py-1 text-left"
      >
        <Chevron size={14} className="shrink-0" />
        <CircleCheck size={14} className="shrink-0" />
        <span className="text-xs font-medium">{bandLabel(count)}</span>
        <span className="truncate text-xs" suppressHydrationWarning>
          {relativeTime(lastAt)}
        </span>
      </button>
    </div>
  );
});
