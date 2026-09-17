"use client";

import { authClient } from "@roster/auth/client";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@roster/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
}

export interface InviteRow {
  id: string;
  email: string;
  role: string | null;
  expiresAt: Date;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export function MembersClient({
  organizationId,
  members,
  invitations,
  currentUserId,
  canManage,
}: {
  organizationId: string;
  members: MemberRow[];
  invitations: InviteRow[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;

    setPending(true);
    setError(null);
    setSentTo(null);

    const { error: inviteError } = await authClient.organization.inviteMember({
      email: address,
      role: role as "member" | "admin" | "owner",
      organizationId,
    });

    setPending(false);
    if (inviteError) {
      setError(inviteError.message ?? "Couldn't send that invitation.");
      return;
    }

    setEmail("");
    setSentTo(address);
    router.refresh();
  }

  async function revoke(invitationId: string) {
    await authClient.organization.cancelInvitation({ invitationId });
    router.refresh();
  }

  async function remove(memberId: string) {
    await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId,
    });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {canManage ? (
        <section className="bg-background-3 border-border rounded-lg border p-5">
          <h2 className="text-sm font-medium">Invite someone</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            They'll get an email with a link. It expires in 7 days.
          </p>
          <form onSubmit={invite} className="mt-4 flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="teammate@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="w-32 space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role" showIcon>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Invite"}
            </Button>
          </form>
          {error ? (
            <p className="text-destructive mt-3 text-sm">{error}</p>
          ) : null}
          {sentTo ? (
            <p className="text-muted-foreground mt-3 text-sm">
              Invitation sent to {sentTo}.
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium">
          Members <span className="text-muted-foreground">{members.length}</span>
        </h2>
        <ul className="border-border mt-3 divide-y rounded-lg border">
          {members.map((member) => (
            <li
              key={member.id}
              className="bg-background-3 flex items-center gap-3 px-4 py-3 first:rounded-t-lg last:rounded-b-lg"
            >
              <Avatar className="size-7">
                <AvatarFallback className="text-[11px]">
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
                  {member.email}
                </div>
              </div>
              <Badge variant="secondary">{member.role}</Badge>
              {canManage &&
              member.userId !== currentUserId &&
              member.role !== "owner" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(member.id)}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {invitations.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium">
            Pending invitations{" "}
            <span className="text-muted-foreground">{invitations.length}</span>
          </h2>
          <ul className="border-border mt-3 divide-y rounded-lg border">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="bg-background-3 flex items-center gap-3 px-4 py-3 first:rounded-t-lg last:rounded-b-lg"
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
      ) : null}
    </div>
  );
}
