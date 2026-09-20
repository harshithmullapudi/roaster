import { cn } from "@roster/ui";

import { LOCKUP_PATH, LOCKUP_VIEWBOX } from "~/utils/logo-paths";

import { Glyph } from "./glyph";

export function RosterLockup({ className }: { className?: string }) {
  return (
    <Glyph
      path={LOCKUP_PATH}
      viewBox={LOCKUP_VIEWBOX}
      className={cn("h-3 w-auto", className)}
    />
  );
}
