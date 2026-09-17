"use client";

import type { ThreadDetail } from "@roster/api";
import { Button } from "@roster/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Square } from "lucide-react";
import { useState } from "react";

import { threadDetailKey } from "~/utils/thread-rows";
import { trpc } from "~/utils/trpc";

export interface ThreadCancelProps {
  projectId: string;
  threadId: string;
}

export function ThreadCancel({ projectId, threadId }: ThreadCancelProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function cancel() {
    setPending(true);
    try {
      const fresh = await trpc.threads.cancel.mutate({ projectId, threadId });
      if (fresh) {
        queryClient.setQueryData<ThreadDetail>(
          threadDetailKey(threadId),
          (previous) => (previous ? { ...previous, thread: fresh } : previous),
        );
      }
    } catch {
      console.warn("[threads] cancel failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="xs"
      className="self-start gap-1.5 text-xs"
      isLoading={pending}
      onClick={cancel}
    >
      <Square size={12} />
      Cancel
    </Button>
  );
}
