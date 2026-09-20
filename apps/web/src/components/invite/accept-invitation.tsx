"use client";

import { authClient } from "@roster/auth/client";
import { Button, Input, Label } from "@roster/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { errorMessage } from "~/utils/trpc";

export interface AcceptInvitationProps {
  invitationId: string;
  initialUserName: string;
}

export function AcceptInvitation({
  invitationId,
  initialUserName,
}: AcceptInvitationProps) {
  const router = useRouter();
  const [userName, setUserName] = useState(initialUserName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(event: FormEvent) {
    event.preventDefault();
    const person = userName.trim();
    if (!person) return;

    setPending(true);
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

      const { error: acceptError } =
        await authClient.organization.acceptInvitation({ invitationId });

      if (acceptError) {
        throw new Error(
          acceptError.message ??
            "Couldn't accept this invitation. Check you're signed in with the invited email.",
        );
      }

      router.push("/onboarding");
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause, "Something went wrong."));
      setPending(false);
    }
  }

  return (
    <form onSubmit={accept} className="space-y-4">
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

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" size="lg" full disabled={pending}>
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
    </form>
  );
}
