"use client";

import { authClient } from "@roster/auth/client";
import { Badge, Button } from "@roster/ui";
import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface InviteRow {
  id: string;
  email: string;
  role: string | null;
  expiresAt: Date;
}

export interface PendingInvitationsProps {
  invitations: InviteRow[];
  canManage: boolean;
  origin: string;
}

export function PendingInvitations({
  invitations,
  canManage,
  origin,
}: PendingInvitationsProps) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function revoke(invitationId: string) {
    await authClient.organization.cancelInvitation({ invitationId });
    router.refresh();
  }

  return (
    <section>
      <h2 className="text-sm font-medium">
        Pending invitations{" "}
        <span className="text-muted-foreground">{invitations.length}</span>
      </h2>
      <ul className="bg-background-3 text-foreground mt-2 flex flex-col divide-y rounded">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{invitation.email}</div>
              <div className="text-muted-foreground text-xs">
                Expires {invitation.expiresAt.toLocaleDateString()}
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {invitation.role ?? "member"}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              aria-label={`Copy the invitation link for ${invitation.email}`}
              onClick={() => {
                void navigator.clipboard.writeText(
                  `${origin}/invite/${invitation.id}`,
                );
                setCopiedId(invitation.id);
              }}
            >
              {copiedId === invitation.id ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
            </Button>
            {canManage ? (
              <Button
                variant="ghost"
                className="shrink-0"
                onClick={() => revoke(invitation.id)}
              >
                Revoke
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
