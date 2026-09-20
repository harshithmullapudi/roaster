import { cn } from "@roster/ui";

import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "~/utils/logo-paths";

import { Glyph } from "./glyph";

export function RosterWordmark({ className }: { className?: string }) {
  return (
    <Glyph
      path={WORDMARK_PATH}
      viewBox={WORDMARK_VIEWBOX}
      className={cn("h-3 w-auto", className)}
    />
  );
}
