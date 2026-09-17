import { cn } from "@roster/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export interface SidebarLinkProps {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
}

export function SidebarLink({ href, active, icon, label }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-7 items-center gap-2 rounded px-2 text-sm transition-colors",
        active
          ? "bg-grayAlpha-100 text-foreground font-medium"
          : "text-muted-foreground hover:bg-grayAlpha-100 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
