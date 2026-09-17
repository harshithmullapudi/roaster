import { cn } from "@roster/ui";

import { WORDMARK_PATH } from "~/utils/logo-paths";

import { Glyph } from "./glyph";

export function RosterWordmark({ className }: { className?: string }) {
  return (
    <Glyph
      path={WORDMARK_PATH}
      viewBox="0 0 23 5"
      className={cn("h-3 w-auto", className)}
    />
  );
}
