"use client";

import { authClient } from "@roster/auth/client";
import { Button } from "@roster/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInvitation({
  invitationId,
  slug,
}: {
  invitationId: string;
  slug: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setPending(true);
    setError(null);

    const { error: acceptError } = await authClient.organization.acceptInvitation(
      { invitationId },
    );

    if (acceptError) {
      // The common cause is signing in with a different address than the one
      // invited, so say that rather than echoing better-auth's wording.
      setError(
        acceptError.message ??
          "Couldn't accept this invitation. Check you're signed in with the invited email.",
      );
      setPending(false);
      return;
    }

    router.push(`/${slug}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={accept} disabled={pending}>
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
