"use client";

import type { ChannelGroups } from "@roster/api";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@roster/ui";
import { CircleCheck, Hash, Plus, Star, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { flattenChannels } from "~/components/tasks/channel-picker";

export interface CommandBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  channels: ChannelGroups;
  onNewTask: () => void;
}

export function CommandBar({
  open,
  onOpenChange,
  orgSlug,
  channels,
  onNewTask,
}: CommandBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const starred = new Set(channels.starred.map((channel) => channel.id));
  const allChannels = flattenChannels(channels);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title="Command bar"
      description="Jump to a channel or start something new."
    >
      <CommandInput
        placeholder="Search channels and actions..."
        value={query}
        onValueChange={setQuery}
        autoFocus
      />
      <CommandList className="max-h-80">
        <CommandEmpty className="text-muted-foreground py-6 text-sm">
          Nothing matches “{query}”.
        </CommandEmpty>

        {allChannels.length > 0 && (
          <CommandGroup heading="Channels">
            {allChannels.map((channel) => (
              <CommandItem
                key={channel.id}
                value={`channel ${channel.slug} ${channel.name}`}
                onSelect={() => go(`/${orgSlug}/${channel.slug}`)}
              >
                <Hash size={14} className="text-muted-foreground" />
                <span className="flex-1 truncate">{channel.slug}</span>
                {starred.has(channel.id) && (
                  <Star size={13} className="text-muted-foreground shrink-0" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem
            value="go to tasks"
            onSelect={() => go(`/${orgSlug}/tasks`)}
          >
            <CircleCheck size={14} className="text-muted-foreground" />
            <span>Tasks</span>
          </CommandItem>
          <CommandItem
            value="go to members"
            onSelect={() => go(`/${orgSlug}/settings/members`)}
          >
            <Users size={14} className="text-muted-foreground" />
            <span>Members</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            value="new task create"
            onSelect={() => {
              onOpenChange(false);
              onNewTask();
            }}
          >
            <Plus size={14} className="text-muted-foreground" />
            <span>New task</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
