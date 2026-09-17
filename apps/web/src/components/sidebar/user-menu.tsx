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
} from "@roster/ui";
import { useRouter } from "next/navigation";

import { ThemeToggleItem } from "~/components/theme/theme-toggle-item";
import type { UserSummary } from "~/types";
import { initials } from "~/utils/initials";

export function UserMenu({ user }: { user: UserSummary }) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="lg" full className="justify-start gap-2 px-2">
          <Avatar className="size-5">
            <AvatarFallback className="text-[10px]">
              {initials(user.name || user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm">{user.name || user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeToggleItem />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
