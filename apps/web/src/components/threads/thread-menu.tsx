"use client";

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@roster/ui";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import {
  ThreadCompleteDialogs,
  ThreadCompleteMenuItem,
  useThreadCompletion,
} from "./thread-completion";

export interface ThreadMenuProps {
  projectId: string;
  threadId: string;
  status: string;
  completedAt: Date | null;
  className?: string;
}

export function ThreadMenu({
  projectId,
  threadId,
  status,
  completedAt,
  className,
}: ThreadMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const completion = useThreadCompletion({
    projectId,
    threadId,
    status,
    completedAt,
  });

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Thread actions"
            className={cn("text-muted-foreground !rounded-md", className)}
          >
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <ThreadCompleteMenuItem
            completion={completion}
            closeMenu={() => setMenuOpen(false)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <ThreadCompleteDialogs completion={completion} />
    </>
  );
}
