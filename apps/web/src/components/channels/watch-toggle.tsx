"use client";

import { Button } from "@roster/ui";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { trpc } from "~/utils/trpc";

export interface WatchToggleProps {
  projectId: string;
  enabled: boolean;
}

export function WatchToggle({ projectId, enabled }: WatchToggleProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      await trpc.channels.setWatch.mutate({ projectId, enabled: !enabled });
      router.refresh();
    } catch {
      console.warn("[channels] watch toggle failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="xs"
      className="gap-1.5 px-1.5 text-xs"
      aria-label={enabled ? "Pause agent watching" : "Resume agent watching"}
      isLoading={pending}
      onClick={toggle}
    >
      {enabled ? <Eye size={14} /> : <EyeOff size={14} />}
      <span className={enabled ? "text-muted-foreground" : "text-foreground"}>
        {enabled ? "Watching" : "Paused"}
      </span>
    </Button>
  );
}
