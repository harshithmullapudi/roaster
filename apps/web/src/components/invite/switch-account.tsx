"use client";

import { authClient } from "@roster/auth/client";
import { Button } from "@roster/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SwitchAccountProps {
  /** The address the invitation was sent to. */
  email: string;
}

/**
 * Signing out drops the page into its signed-out branch, which offers the
 * invited address — otherwise being signed in as the wrong person is a dead
 * end with nothing to click.
 */
export function SwitchAccount({ email }: SwitchAccountProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function switchAccount() {
    setPending(true);
    await authClient.signOut();
    router.refresh();
  }

  return (
    <Button size="lg" full onClick={switchAccount} disabled={pending}>
      {pending ? "Signing out…" : `Sign in as ${email}`}
    </Button>
  );
}
