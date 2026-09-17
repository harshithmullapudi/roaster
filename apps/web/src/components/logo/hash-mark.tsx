import { cn } from "@roster/ui";

import { MARK_PATH } from "~/utils/logo-paths";

import { Glyph } from "./glyph";

export function HashMark({ className }: { className?: string }) {
  return (
    <Glyph
      path={MARK_PATH}
      viewBox="0 0 5 5"
      label={null}
      className={cn(
        "size-[14px] shrink-0 text-current [shape-rendering:auto]",
        className,
      )}
    />
  );
}
