import { cn } from "@roster/ui";

import { HASH_PATH, HASH_VIEWBOX } from "~/utils/logo-paths";

import { Glyph } from "./glyph";

export function HashMark({ className }: { className?: string }) {
  return (
    <Glyph
      path={HASH_PATH}
      viewBox={HASH_VIEWBOX}
      label={null}
      className={cn(
        "size-[14px] shrink-0 text-current [shape-rendering:auto]",
        className,
      )}
    />
  );
}
