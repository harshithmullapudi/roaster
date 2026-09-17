import { cn } from "@roster/ui";

import { MARK_PATH } from "~/utils/logo-paths";

import { Glyph } from "./glyph";

export function RosterMark({ className }: { className?: string }) {
  return (
    <Glyph path={MARK_PATH} viewBox="0 0 5 5" className={cn("h-4", className)} />
  );
}
