"use client";

import { Button } from "@roster/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { pausedMessagesLabel } from "~/utils/watch";
import { trpc } from "~/utils/trpc";

export interface WatchResumeOfferProps {
  projectId: string;
  count: number;
}

export function WatchResumeOffer({ projectId, count }: WatchResumeOfferProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"start" | "dismiss" | null>(null);

  async function start() {
    setPending("start");
    try {
      await trpc.channels.startFromPause.mutate({ projectId });
      router.refresh();
    } catch {
      console.warn("[channels] start from pause failed");
    } finally {
      setPending(null);
    }
  }

  async function dismiss() {
    setPending("dismiss");
    try {
      await trpc.channels.dismissPause.mutate({ projectId });
      router.refresh();
    } catch {
      console.warn("[channels] dismiss pause failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="border-border mx-1 mb-2 flex items-center gap-2 rounded-md border px-2.5 py-2">
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
        {`Start a session from the ${pausedMessagesLabel(count)} since you paused?`}
      </span>
      <Button
        variant="secondary"
        size="xs"
        className="text-xs"
        isLoading={pending === "start"}
        onClick={start}
      >
        Start
      </Button>
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground text-xs"
        isLoading={pending === "dismiss"}
        onClick={dismiss}
      >
        Dismiss
      </Button>
    </div>
  );
}
