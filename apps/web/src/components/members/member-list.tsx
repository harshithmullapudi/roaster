"use client";

import { authClient } from "@roster/auth/client";
import { AvatarText, Badge, Button } from "@roster/ui";
import { useRouter } from "next/navigation";

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  agentName: string | null;
  supersetConnected: boolean;
}

export interface MemberListProps {
  organizationId: string;
  members: MemberRow[];
  currentUserId: string;
  canManage: boolean;
}

export function MemberList({
  organizationId,
  members,
  currentUserId,
  canManage,
}: MemberListProps) {
  const router = useRouter();

  async function remove(memberId: string) {
    await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId,
    });
    router.refresh();
  }

  return (
    <section>
      <h2 className="text-sm font-medium">
        Members <span className="text-muted-foreground">{members.length}</span>
      </h2>
      <ul className="bg-background-3 text-foreground mt-2 flex flex-col divide-y rounded">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4"
          >
            <AvatarText
              text={member.name || member.email}
              className="h-5 w-5 rounded text-xs"
            />

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">
                {member.name || member.email}
                {member.userId === currentUserId ? (
                  <span className="text-muted-foreground"> (you)</span>
                ) : null}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {member.agentName ? `@${member.agentName}` : member.email}
              </div>
            </div>

            {!member.supersetConnected ? (
              <Badge
                variant="secondary"
                className="text-warning hidden shrink-0 sm:inline-flex"
              >
                not connected
              </Badge>
            ) : null}
            <Badge variant="secondary" className="shrink-0">
              {member.role}
            </Badge>

            {canManage &&
            member.userId !== currentUserId &&
            member.role !== "owner" ? (
              <Button
                variant="ghost"
                className="shrink-0"
                onClick={() => remove(member.id)}
              >
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
