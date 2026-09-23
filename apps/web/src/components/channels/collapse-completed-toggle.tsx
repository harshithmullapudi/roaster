"use client";

import { Button } from "@roster/ui";
import { FoldVertical, UnfoldVertical } from "lucide-react";

import { useCollapseCompleted } from "~/hooks/use-collapse-completed";

export interface CollapseCompletedToggleProps {
  projectId: string;
}

export function CollapseCompletedToggle({
  projectId,
}: CollapseCompletedToggleProps) {
  const { collapse, setCollapse } = useCollapseCompleted(projectId);

  return (
    <Button
      variant="ghost"
      size="xs"
      className="gap-1.5 px-1.5 text-xs"
      aria-label={
        collapse ? "Show completed conversations" : "Fold completed conversations"
      }
      aria-pressed={collapse}
      onClick={() => setCollapse(!collapse)}
    >
      {collapse ? <FoldVertical size={14} /> : <UnfoldVertical size={14} />}
      <span className={collapse ? "text-muted-foreground" : "text-foreground"}>
        {collapse ? "Folded" : "All shown"}
      </span>
    </Button>
  );
}
