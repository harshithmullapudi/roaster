"use client";

import { authClient } from "@roster/auth/client";
import { Button } from "@roster/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SwitchAccountProps {
  email: string;
}

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
