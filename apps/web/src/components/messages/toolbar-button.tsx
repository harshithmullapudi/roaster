"use client";

import { cn } from "@roster/ui";
import type { ReactNode } from "react";

export interface ToolbarButtonProps {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function ToolbarButton({
  title,
  active,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-grayAlpha-100 flex h-6 w-6 items-center justify-center rounded transition-colors",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}
