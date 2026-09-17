import type { ReactNode } from "react";

import { RosterLockup } from "~/components/logo/roster-lockup";

export interface AuthShellProps {
  title: string;
  children: ReactNode;
}

export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[352px]">
        <RosterLockup className="mb-5 h-3" />
        <div className="bg-background-3 border-border shadow-1 rounded-lg border p-5">
          <h1 className="mb-4 text-base font-semibold tracking-tight">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </main>
  );
}
