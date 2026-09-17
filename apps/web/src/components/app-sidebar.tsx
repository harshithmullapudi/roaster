"use client";

import { authClient } from "@roster/auth/client";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from "@roster/ui";
import { Check, ChevronsUpDown, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface SidebarOrg {
  id: string;
  name: string;
  slug: string;
}

export interface SidebarUser {
  name: string;
  email: string;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export function AppSidebar({
  activeOrg,
  organizations,
  user,
  currentPath,
}: {
  activeOrg: SidebarOrg;
  organizations: SidebarOrg[];
  user: SidebarUser;
  currentPath: "home" | "members";
}) {
  const router = useRouter();

  async function switchTo(org: SidebarOrg) {
    if (org.id === activeOrg.id) return;
    await authClient.organization.setActive({ organizationId: org.id });
    router.push(`/${org.slug}`);
    router.refresh();
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <aside className="bg-background border-border flex w-60 shrink-0 flex-col border-r">
      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-between px-2 py-1.5"
            >
              <span className="truncate text-sm font-medium">
                {activeOrg.name}
              </span>
              <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Teams
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem key={org.id} onSelect={() => switchTo(org)}>
                <span className="truncate">{org.name}</span>
                {org.id === activeOrg.id ? (
                  <Check className="ml-auto size-3.5" />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding">
                <Plus className="size-3.5" />
                New team
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        <SidebarLink
          href={`/${activeOrg.slug}`}
          active={currentPath === "home"}
          icon={<Settings className="size-3.5" />}
          label="Channels"
        />
        <SidebarLink
          href={`/${activeOrg.slug}/settings/members`}
          active={currentPath === "members"}
          icon={<Users className="size-3.5" />}
          label="Members"
        />
      </nav>

      <div className="border-border border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-2 px-2 py-1.5"
            >
              <Avatar className="size-5">
                <AvatarFallback className="text-[10px]">
                  {initials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">
                {user.name || user.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
