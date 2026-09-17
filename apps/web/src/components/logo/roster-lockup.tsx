import { cn } from "@roster/ui";

import { LOCKUP_PATH } from "~/utils/logo-paths";

import { Glyph } from "./glyph";

export function RosterLockup({ className }: { className?: string }) {
  return (
    <Glyph
      path={LOCKUP_PATH}
      viewBox="0 0 30 5"
      className={cn("h-3 w-auto", className)}
    />
  );
}
