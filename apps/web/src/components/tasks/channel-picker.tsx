"use client";

import type { Channel, ChannelGroups } from "@roster/api";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "@roster/ui";
import { Check, Hash } from "lucide-react";
import { useMemo, useState } from "react";

export function flattenChannels(groups: ChannelGroups): Channel[] {
  return [...groups.starred, ...groups.public, ...groups.private];
}

export interface ChannelPickerProps {
  channels: ChannelGroups;
  value: string | null;
  onChange: (projectId: string) => void;
}

export function ChannelPicker({
  channels,
  value,
  onChange,
}: ChannelPickerProps) {
  const [open, setOpen] = useState(false);
  const all = useMemo(() => flattenChannels(channels), [channels]);
  const selected = all.find((channel) => channel.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="max-w-48 gap-1.5 rounded-full px-2.5 text-xs font-normal"
        >
          <Hash size={13} className="text-muted-foreground shrink-0" />
          <span className="truncate">{selected?.slug ?? "Channel"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent className="w-60 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search channels..." autoFocus />
            <CommandList>
              <CommandEmpty className="text-muted-foreground py-4 text-sm">
                No channels found.
              </CommandEmpty>
              <CommandGroup>
                {all.map((channel) => (
                  <CommandItem
                    key={channel.id}
                    value={channel.slug}
                    onSelect={() => {
                      onChange(channel.id);
                      setOpen(false);
                    }}
                  >
                    <Hash size={14} className="text-muted-foreground" />
                    <span className="flex-1 truncate">{channel.slug}</span>
                    {channel.id === value && (
                      <Check size={14} className="ml-auto" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
