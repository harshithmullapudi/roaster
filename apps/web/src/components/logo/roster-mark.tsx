import { cn } from "@roster/ui";

import { MARK_PATH, MARK_VIEWBOX } from "~/utils/logo-paths";

import { Glyph } from "./glyph";

export function RosterMark({ className }: { className?: string }) {
  return (
    <Glyph
      path={MARK_PATH}
      viewBox={MARK_VIEWBOX}
      className={cn("h-4", className)}
    />
  );
}
