"use client";

import { authClient } from "@roster/auth/client";
import {
  AvatarText,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@roster/ui";
import { Check, ChevronDown, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ThemeToggleItem } from "~/components/theme/theme-toggle-item";
import type { OrgSummary, UserSummary } from "~/types";

export interface WorkspaceMenuProps {
  activeOrg: OrgSummary;
  organizations: OrgSummary[];
  user: UserSummary;
}

export function WorkspaceMenu({
  activeOrg,
  organizations,
  user,
}: WorkspaceMenuProps) {
  const router = useRouter();

  async function switchTo(org: OrgSummary) {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          full
          className="min-w-0 justify-start gap-1.5 !rounded-md px-1.5"
        >
          <AvatarText
            text={activeOrg.name}
            className="h-5 w-5 shrink-0 rounded text-[11px]"
          />
          <span className="min-w-0 truncate text-left font-medium">
            {activeOrg.name}
          </span>
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={4} className="min-w-60">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="grid px-2 py-1.5 text-left leading-tight">
            <span className="truncate font-medium">
              {user.name || user.email}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="gap-2">
          <Link href={`/${activeOrg.slug}/settings/preferences`}>
            <Settings className="size-3.5" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <Link href={`/${activeOrg.slug}/settings/members`}>
            <Users className="size-3.5" />
            Invite people
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 py-1">
            Switch team
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-56">
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                className="flex items-center justify-between gap-2"
                onSelect={() => switchTo(org)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AvatarText
                    text={org.name}
                    className="h-5 w-5 shrink-0 rounded text-[11px]"
                  />
                  <span className="truncate">{org.name}</span>
                </div>
                {org.id === activeOrg.id ? (
                  <Check size={14} className="text-primary shrink-0" />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/onboarding">
                <Plus className="size-3.5" />
                New team
              </Link>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <ThemeToggleItem />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
