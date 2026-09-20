"use client";

import type { InviteLink } from "@roster/api";
import { Button } from "@roster/ui";
import { Check, Copy, Link2, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorMessage, trpc } from "~/utils/trpc";

export interface InviteLinkCardProps {
  link: InviteLink | null;
  origin: string;
}

function expiryLabel(expiresAt: Date): string {
  const days = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function InviteLinkCard({ link, origin }: InviteLinkCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"refresh" | "revoke" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = link ? `${origin}/join/${link.token}` : null;

  async function run(action: "refresh" | "revoke") {
    setPending(action);
    setError(null);
    setCopied(false);
    try {
      await trpc.inviteLinks[action].mutate();
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't update the invite link."));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="bg-background-3 text-foreground rounded p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <Link2 size={14} className="text-muted-foreground" />
        Invite link
      </h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {link
          ? link.expired
            ? "This link has expired. Refresh it to hand out a new one."
            : `Anyone with this link can join as a member. Expires ${expiryLabel(link.expiresAt)}.`
          : "Share one link instead of inviting people by name. Anyone who has it can join as a member."}
      </p>

      {url && !link?.expired ? (
        <div className="mt-3 flex items-center gap-2">
          <code className="bg-grayAlpha-100 flex-1 truncate rounded px-2 py-1 font-mono text-xs">
            {url}
          </code>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Copy invite link"
            onClick={() => {
              void navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          disabled={pending !== null}
          onClick={() => void run("refresh")}
        >
          {link ? <RefreshCw size={13} /> : <Plus size={13} />}
          {link ? "Refresh" : "Create invite link"}
        </Button>
        {link && !link.expired ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending !== null}
            onClick={() => void run("revoke")}
          >
            Turn off
          </Button>
        ) : null}
      </div>

      {link && !link.expired ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Refreshing replaces the link — the old one stops working straight
          away.
        </p>
      ) : null}

      {error ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}
    </section>
  );
}
