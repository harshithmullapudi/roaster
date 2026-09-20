"use client";

import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@roster/ui";
import { CircleCheck, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import {
  ThreadCompleteDialogs,
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
          {completion.completed ? (
            <DropdownMenuItem disabled className="gap-2">
              <CircleCheck size={14} />
              Completed
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="gap-2"
              onSelect={(event) => {
                event.preventDefault();
                setMenuOpen(false);
                completion.start();
              }}
            >
              <CircleCheck size={14} />
              Mark as complete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ThreadCompleteDialogs completion={completion} />
    </>
  );
}
