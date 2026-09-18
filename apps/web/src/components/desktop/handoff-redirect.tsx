"use client";

import { Button } from "@roster/ui";
import { useEffect } from "react";

export interface HandoffRedirectProps {
  /** `roster://auth?token=…` — the app is registered for the scheme. */
  deepLink: string;
}

export function HandoffRedirect({ deepLink }: HandoffRedirectProps) {
  useEffect(() => {
    window.location.href = deepLink;
  }, [deepLink]);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Handing this session to the Roster app. You can close this tab once it
        opens.
      </p>
      <Button
        size="lg"
        full
        onClick={() => {
          window.location.href = deepLink;
        }}
      >
        Open Roster
      </Button>
    </div>
  );
}
