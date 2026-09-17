import { cn } from "@roster/ui";
import type { ReactNode } from "react";

import { RosterLockup } from "~/components/logo/roster-lockup";

export type OnboardingStepKey =
  | "workspace"
  | "connect"
  | "organization"
  | "projects"
  | "agent";

export interface OnboardingShellProps {
  step: OnboardingStepKey;
  visibleSteps: readonly OnboardingStepKey[];
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export function OnboardingShell({
  step,
  visibleSteps,
  title,
  children,
  wide = false,
}: OnboardingShellProps) {
  const currentIndex = visibleSteps.indexOf(step);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className={cn("w-full", wide ? "max-w-[480px]" : "max-w-[352px]")}>
        <RosterLockup className="mb-5 h-3" />

        <div className="bg-background-3 border-border shadow-1 rounded-lg border p-5">
          <div className="mb-4 flex items-center gap-1">
            {visibleSteps.map((key, index) => (
              <span
                key={key}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  index <= currentIndex ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>

          <h1 className="mb-4 text-base font-semibold tracking-tight">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </main>
  );
}
