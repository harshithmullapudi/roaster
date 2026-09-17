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
import { flattenChannels } from "~/components/tasks/channel-picker";
import { NewTaskDialog } from "~/components/tasks/new-task-dialog";
import { useShortcuts } from "~/hooks/use-shortcuts";

interface CommandContextValue {
  openCommandBar: () => void;
  openNewTask: () => void;
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
  activeChannelSlug?: string;
  children: ReactNode;
}

export function CommandProvider({
  orgSlug,
  channels,
  activeChannelSlug,
  children,
}: CommandProviderProps) {
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const activeProjectId = useMemo(() => {
    if (!activeChannelSlug) return null;
    const match = flattenChannels(channels).find(
      (channel) => channel.slug === activeChannelSlug,
    );
    return match?.id ?? null;
  }, [channels, activeChannelSlug]);

  const openCommandBar = useCallback(() => setCommandBarOpen(true), []);
  const openNewTask = useCallback(() => setNewTaskOpen(true), []);

  useShortcuts([
    {
      // Chrome hands ⌘K to the omnibox and Arc to its own bar unless the page
      // claims it first.
      key: "$mod+k",
      preventDefault: true,
      handler: () => setCommandBarOpen((current) => !current),
    },
  ]);

  const value = useMemo(
    () => ({ openCommandBar, openNewTask }),
    [openCommandBar, openNewTask],
  );

  return (
    <CommandContext.Provider value={value}>
      {children}

      <CommandBar
        open={commandBarOpen}
        onOpenChange={setCommandBarOpen}
        orgSlug={orgSlug}
        channels={channels}
        onNewTask={openNewTask}
      />

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        channels={channels}
        defaultProjectId={activeProjectId}
      />
    </CommandContext.Provider>
  );
}
