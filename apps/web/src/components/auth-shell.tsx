import type { ReactNode } from "react";

import { RosterLockup } from "./roster-logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <RosterLockup className="mb-6 h-3.5" />
        <div className="bg-background-3 border-border rounded-lg border p-6 shadow-1">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
          ) : null}
          <div className="mt-5">{children}</div>
        </div>
        {footer ? (
          <p className="text-muted-foreground mt-4 text-xs">{footer}</p>
        ) : null}
      </div>
    </main>
  );
}
