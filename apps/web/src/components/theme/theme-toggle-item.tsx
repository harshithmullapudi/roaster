"use client";

import { DropdownMenuItem } from "@roster/ui";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggleItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        setTheme(isDark ? "light" : "dark");
      }}
    >
      {isDark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      {isDark ? "Dark" : "Light"}
    </DropdownMenuItem>
  );
}
