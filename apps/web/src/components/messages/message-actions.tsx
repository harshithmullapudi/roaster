"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@roster/ui";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

export interface MessageActionsProps {
  hasSession: boolean;
  onDelete: () => Promise<void>;
}

export function MessageActions({ hasSession, onDelete }: MessageActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await onDelete();
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Message actions"
            className="text-muted-foreground bg-background border-border absolute top-0 right-3 z-10 border opacity-0 shadow-sm transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100 sm:right-5"
          >
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive gap-2"
            onSelect={(event) => {
              event.preventDefault();
              setMenuOpen(false);
              if (hasSession) setConfirming(true);
              else void remove();
            }}
          >
            <Trash2 size={14} />
            Delete message
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message started a session. Deleting it stops the agent and
              removes its worktree from the machine — any work in there that
              has not been pushed is gone. The replies go with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-100 text-red-500 hover:bg-red-200"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {pending ? "Deleting…" : "Delete and stop the session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
