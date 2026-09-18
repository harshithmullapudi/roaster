"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@roster/ui";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { SettingRow } from "./settings-page";

export function ThemeSetting() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <SettingRow label="Theme" description="How Roster looks on this device.">
      <Select
        value={mounted ? (resolvedTheme ?? "light") : "light"}
        onValueChange={setTheme}
      >
        <SelectTrigger showIcon aria-label="Theme" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    </SettingRow>
  );
}
