"use client";

import type { ChannelGroups } from "@roster/api";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CommandBar } from "~/components/command-bar/command-bar";
import { useShortcuts } from "~/hooks/use-shortcuts";

interface CommandContextValue {
  openCommandBar: () => void;
}

const CommandContext = createContext<CommandContextValue | null>(null);

export function useCommands(): CommandContextValue {
  const value = useContext(CommandContext);
  if (!value) {
    throw new Error("useCommands must be used inside <CommandProvider>.");
  }
  return value;
}

export interface CommandProviderProps {
  orgSlug: string;
  channels: ChannelGroups;
  children: ReactNode;
}

export function CommandProvider({
  orgSlug,
  channels,
  children,
}: CommandProviderProps) {
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  const openCommandBar = useCallback(() => setCommandBarOpen(true), []);

  useShortcuts([
    {
      key: "$mod+k",
      preventDefault: true,
      handler: () => setCommandBarOpen((current) => !current),
    },
  ]);

  const value = useMemo(() => ({ openCommandBar }), [openCommandBar]);

  return (
    <CommandContext.Provider value={value}>
      {children}

      <CommandBar
        open={commandBarOpen}
        onOpenChange={setCommandBarOpen}
        orgSlug={orgSlug}
        channels={channels}
      />
    </CommandContext.Provider>
  );
}
