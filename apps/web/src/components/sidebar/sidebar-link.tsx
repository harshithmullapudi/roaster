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
      className={cn(
        "text-foreground w-fit gap-1 !rounded-md",
        active && "!bg-accent !text-accent-foreground",
      )}
      asChild
    >
      <Link href={href}>
        {icon}
        {label}
      </Link>
    </Button>
  );
}
