import { cn } from "@roster/ui";

export interface GlyphProps {
  path: string;
  viewBox: string;
  className?: string;
}

export function Glyph({ path, viewBox, className }: GlyphProps) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Roster"
      shapeRendering="crispEdges"
      className={cn("text-foreground", className)}
    >
      <title>Roster</title>
      <path d={path} fill="currentColor" />
    </svg>
  );
}
