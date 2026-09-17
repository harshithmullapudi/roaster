import { cn } from "@roster/ui";

export interface GlyphProps {
  path: string;
  viewBox: string;
  className?: string;
  label?: string | null;
}

export function Glyph({ path, viewBox, className, label = "Roster" }: GlyphProps) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      shapeRendering="crispEdges"
      className={cn("text-foreground", className)}
    >
      {label ? <title>{label}</title> : null}
      <path d={path} fill="currentColor" />
    </svg>
  );
}
