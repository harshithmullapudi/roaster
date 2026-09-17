"use client";

import { authClient } from "@roster/auth/client";
import { Avatar, AvatarFallback, Badge, Button } from "@roster/ui";
import { useRouter } from "next/navigation";

import { initials } from "~/utils/initials";

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
      <ul className="border-border mt-2 divide-y rounded-lg border">
        {members.map((member) => (
          <li
            key={member.id}
            className="bg-background-3 flex items-center gap-3 px-3 py-2.5 first:rounded-t-lg last:rounded-b-lg"
          >
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">
                {initials(member.name || member.email)}
              </AvatarFallback>
            </Avatar>

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
              <Badge variant="secondary" className="text-warning">
                not connected
              </Badge>
            ) : null}
            <Badge variant="secondary">{member.role}</Badge>

            {canManage &&
            member.userId !== currentUserId &&
            member.role !== "owner" ? (
              <Button variant="ghost" size="sm" onClick={() => remove(member.id)}>
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
