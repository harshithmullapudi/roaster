"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@roster/ui";
import { Plus, SquareTerminal } from "lucide-react";
import { useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

export interface NewSessionPopoverProps {
  projectId: string;
  workspaceId: string;
  onStarted: (terminalId: string) => void;
}

export function NewSessionPopover({
  projectId,
  workspaceId,
  onStarted,
}: NewSessionPopoverProps) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: agents, isPending } = useQuery({
    queryKey: ["terminals", "agents", projectId],
    queryFn: () => trpc.terminals.agents.query({ projectId }),
    enabled: open,
  });

  const start = async (key: string, run: () => Promise<{ terminalId: string }>) => {
    if (starting) return;
    setStarting(key);
    setError(null);
    try {
      const { terminalId } = await run();
      setOpen(false);
      onStarted(terminalId);
    } catch (cause) {
      setError(errorMessage(cause, "Could not start that session."));
    } finally {
      setStarting(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="!h-6 !rounded-md px-1.5"
          aria-label="New session"
        >
          <Plus size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        {isPending ? (
          <p className="text-muted-foreground px-2 py-3 text-xs">Loading agents…</p>
        ) : (
          <>
            {(agents ?? []).map((agent) => (
              <button
                key={agent.id}
                type="button"
                disabled={starting !== null}
                onClick={() =>
                  void start(agent.id, () =>
                    trpc.terminals.spawnAgent.mutate({
                      projectId,
                      workspaceId,
                      presetId: agent.presetId,
                    }),
                  )
                }
                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm disabled:opacity-50"
              >
                <span className="truncate">{agent.label}</span>
                {starting === agent.id ? (
                  <span className="text-muted-foreground ml-auto text-xs">…</span>
                ) : null}
              </button>
            ))}
            <button
              type="button"
              disabled={starting !== null}
              onClick={() =>
                void start("shell", () =>
                  trpc.terminals.spawnShell.mutate({ projectId, workspaceId }),
                )
              }
              className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm disabled:opacity-50"
            >
              <SquareTerminal size={15} className="text-muted-foreground" />
              <span>Shell</span>
              {starting === "shell" ? (
                <span className="text-muted-foreground ml-auto text-xs">…</span>
              ) : null}
            </button>
          </>
        )}
        {error ? (
          <p className="text-destructive px-2 py-1.5 text-xs">{error}</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
