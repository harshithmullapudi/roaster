"use client";

import { authClient } from "@roster/auth/client";
import { Badge, Button } from "@roster/ui";
import { useRouter } from "next/navigation";

export interface InviteRow {
  id: string;
  email: string;
  role: string | null;
  expiresAt: Date;
}

export interface PendingInvitationsProps {
  invitations: InviteRow[];
  canManage: boolean;
}

export function PendingInvitations({
  invitations,
  canManage,
}: PendingInvitationsProps) {
  const router = useRouter();

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
      <ul className="border-border mt-2 divide-y rounded-lg border">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="bg-background-3 flex items-center gap-3 px-3 py-2.5 first:rounded-t-lg last:rounded-b-lg"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{invitation.email}</div>
              <div className="text-muted-foreground text-xs">
                Expires {invitation.expiresAt.toLocaleDateString()}
              </div>
            </div>
            <Badge variant="secondary">{invitation.role ?? "member"}</Badge>
            {canManage ? (
              <Button
                variant="ghost"
                size="sm"
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
