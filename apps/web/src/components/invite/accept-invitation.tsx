"use client";

import { authClient } from "@roster/auth/client";
import { Button } from "@roster/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface AcceptInvitationProps {
  invitationId: string;
  slug: string;
}

export function AcceptInvitation({
  invitationId,
  slug,
}: AcceptInvitationProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);

    const { error: acceptError } =
      await authClient.organization.acceptInvitation({ invitationId });

    if (acceptError) {
      setError(
        acceptError.message ??
          "Couldn't accept this invitation. Check you're signed in with the invited email.",
      );
      setPending(false);
      return;
    }

    router.push(`/onboarding`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Button size="lg" full onClick={accept} disabled={pending}>
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
