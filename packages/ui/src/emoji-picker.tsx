"use client";

import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import {
  type EmojiEntry,
  loadedEmojis,
  loadEmojis,
  searchEmojis,
} from "./emoji-data";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface EmojiGroup {
  group: number;
  heading: string;
  entries: EmojiEntry[];
}

const GROUP_HEADINGS: Record<number, string> = {
  0: "Smileys & Emotion",
  1: "People & Body",
  3: "Animals & Nature",
  4: "Food & Drink",
  5: "Travel & Places",
  6: "Activities",
  7: "Objects",
  8: "Symbols",
  9: "Flags",
};

const MAX_RESULTS = 60;
const DEFAULT_PER_GROUP = 16;

const EMOJI_GRID =
  "**:[[cmdk-group-items]]:grid **:[[cmdk-group-items]]:grid-cols-8 **:[[cmdk-group-items]]:gap-0.5";


function groupEmojis(entries: EmojiEntry[]) {
  const groups: EmojiGroup[] = [];
  const byGroup = new Map<number, EmojiGroup>();

  for (const entry of entries) {
    let group = byGroup.get(entry.group);

    if (!group) {
      group = {
        group: entry.group,
        heading: GROUP_HEADINGS[entry.group] ?? "Other",
        entries: [],
      };
      byGroup.set(entry.group, group);
      groups.push(group);
    }

    if (group.entries.length < DEFAULT_PER_GROUP) {
      group.entries.push(entry);
    }
  }

  return groups;
}

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}

export function EmojiPicker({
  onSelect,
  children,
  align = "start",
}: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [entries, setEntries] = React.useState<EmojiEntry[] | null>(
    loadedEmojis(),
  );

  React.useEffect(() => {
    if (!open || entries) {
      return;
    }

    let cancelled = false;

    void loadEmojis().then((loaded) => {
      if (!cancelled) {
        setEntries(loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, entries]);

  const searching = query.trim().length > 0;

  const matches = React.useMemo(
    () =>
      entries && searching ? searchEmojis(entries, query, MAX_RESULTS) : [],
    [entries, query, searching],
  );

  const groups = React.useMemo(
    () => (entries ? groupEmojis(entries) : []),
    [entries],
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (!next) {
      setQuery("");
    }
  };

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    handleOpenChange(false);
  };

  const renderEntry = (entry: EmojiEntry) => (
    <CommandItem
      key={entry.hexcode}
      value={entry.hexcode}
      aria-label={entry.name}
      title={entry.label}
      onSelect={() => handleSelect(entry.unicode)}
      className="h-8 w-full justify-center rounded-md p-0 text-lg [&>svg]:hidden"
    >
      <span aria-hidden="true">{entry.unicode}</span>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        aria-label="Emoji picker"
        className="w-72 p-0"
      >
        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search emoji"
            aria-label="Search emoji"
          />
          <CommandList>
            {entries ? (
              <>
                <CommandEmpty>No emoji found.</CommandEmpty>
                {searching ? (
                  <CommandGroup className={EMOJI_GRID}>
                    {matches.map(renderEntry)}
                  </CommandGroup>
                ) : (
                  groups.map((group) => (
                    <CommandGroup
                      key={group.group}
                      heading={group.heading}
                      className={EMOJI_GRID}
                    >
                      {group.entries.map(renderEntry)}
                    </CommandGroup>
                  ))
                )}
              </>
            ) : (
              <div className="text-muted-foreground py-6 text-center text-sm">
                Loading emoji...
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
