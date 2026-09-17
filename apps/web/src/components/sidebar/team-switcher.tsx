"use client";

import { authClient } from "@roster/auth/client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@roster/ui";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { OrgSummary } from "~/types";

export interface TeamSwitcherProps {
  activeOrg: OrgSummary;
  organizations: OrgSummary[];
}

export function TeamSwitcher({ activeOrg, organizations }: TeamSwitcherProps) {
  const router = useRouter();

  async function switchTo(org: OrgSummary) {
    if (org.id === activeOrg.id) return;
    await authClient.organization.setActive({ organizationId: org.id });
    router.push(`/${org.slug}`);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="lg" full className="justify-between px-2">
          <span className="truncate text-sm font-medium">{activeOrg.name}</span>
          <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
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
  );
}
