import { Button, cn } from "@roster/ui";
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
    <Button
      variant="ghost"
      isActive={active}
      full
      className={cn(
        "text-foreground min-w-0 justify-start gap-2 !rounded-md px-2 text-sm",
        active && "!bg-accent !text-accent-foreground",
      )}
      asChild
    >
      <Link href={href}>
        <span className="text-muted-foreground flex size-4 shrink-0 items-center justify-center">
          {icon}
        </span>
        <span className="min-w-0 truncate text-left">{label}</span>
      </Link>
    </Button>
  );
}
