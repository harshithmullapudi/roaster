"use client";

import type { UserInvitation } from "@roster/api";
import { authClient } from "@roster/auth/client";
import { Badge, Button, Input, Label } from "@roster/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { errorMessage } from "~/utils/trpc";

export interface JoinTeamFormProps {
  invitations: UserInvitation[];
  initialUserName: string;
}

export function JoinTeamForm({
  invitations,
  initialUserName,
}: JoinTeamFormProps) {
  const router = useRouter();
  const [userName, setUserName] = useState(initialUserName);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          That invitation is no longer open. Ask for a new link, or start a
          workspace of your own.
        </p>
        <Button variant="secondary" size="lg" full asChild>
          <Link href="/onboarding?step=workspace">Create a workspace</Link>
        </Button>
      </div>
    );
  }

  async function join(event: FormEvent, invitationId: string) {
    event.preventDefault();
    const person = userName.trim();
    if (!person) return;

    setJoining(invitationId);
    setError(null);

    try {
      if (person !== initialUserName) {
        const { error: nameError } = await authClient.updateUser({
          name: person,
        });
        if (nameError) {
          throw new Error(nameError.message ?? "Couldn't save your name.");
        }
      }

      const { error: joinError } =
        await authClient.organization.acceptInvitation({ invitationId });

      if (joinError) {
        throw new Error(joinError.message ?? "Couldn't join that workspace.");
      }

      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Something went wrong."));
      setJoining(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="user-name">Your name</Label>
        <Input
          id="user-name"
          name="user-name"
          required
          autoFocus
          autoComplete="name"
          placeholder="Harshith Mullapudi"
          value={userName}
          onChange={(event) => setUserName(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          How your messages are signed in every channel.
        </p>
      </div>

      <ul className="border-border divide-y rounded border">
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            <form
              onSubmit={(event) => join(event, invitation.id)}
              className="flex items-center gap-2 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  {invitation.organization.name}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  Invited by {invitation.inviterName}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {invitation.role ?? "member"}
              </Badge>
              <Button
                type="submit"
                className="shrink-0"
                disabled={joining !== null || !userName.trim()}
              >
                {joining === invitation.id ? "Joining…" : "Join"}
              </Button>
            </form>
          </li>
        ))}
      </ul>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button
        variant="ghost"
        size="lg"
        full
        asChild
        className="text-muted-foreground"
      >
        <Link href="/onboarding?step=workspace">
          Create my own workspace instead
        </Link>
      </Button>
    </div>
  );
}
