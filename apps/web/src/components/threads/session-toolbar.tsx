"use client";

import {
  Badge,
  Button,
  Checkbox,
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
import { Check, ListFilter, X } from "lucide-react";
import { useState } from "react";

import {
  SESSION_STATUS_ORDER,
  type SessionFilters,
  type SessionGroupBy,
} from "~/utils/session-rows";
import { statusLabel } from "~/utils/thread-rows";

import { SessionStatusIcon } from "./session-status";

export interface SessionToolbarProps {
  filters: SessionFilters;
  onFiltersChange: (filters: SessionFilters) => void;
  groupBy: SessionGroupBy;
  onGroupByChange: (groupBy: SessionGroupBy) => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function SessionToolbar({
  filters,
  onFiltersChange,
  groupBy,
  onGroupByChange,
}: SessionToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  return (
    <div className="border-border flex items-center gap-2 border-b px-3 py-1">
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="gap-1.5 rounded-md px-2.5 text-sm">
            <ListFilter size={14} />
            Filter
            {filters.statuses.length > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1.5 text-xs">
                {filters.statuses.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent className="w-60 p-0" align="start">
            <Command>
              <CommandInput placeholder="Filter by..." autoFocus />
              <CommandList>
                <CommandEmpty className="text-muted-foreground py-4 text-sm">
                  Nothing to filter on.
                </CommandEmpty>

                <CommandGroup heading="Status">
                  {SESSION_STATUS_ORDER.map((status) => (
                    <CommandItem
                      key={status}
                      value={`status ${statusLabel(status)}`}
                      onSelect={() =>
                        onFiltersChange({
                          ...filters,
                          statuses: toggle(filters.statuses, status),
                        })
                      }
                    >
                      <Checkbox
                        checked={filters.statuses.includes(status)}
                        className="border-muted-foreground/50 pointer-events-none"
                      />
                      <SessionStatusIcon status={status} size={15} />
                      <span className="flex-1">{statusLabel(status)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </PopoverPortal>
      </Popover>

      {filters.statuses.map((status) => (
        <Badge
          key={status}
          variant="secondary"
          className="h-(--btn-h-default) items-center gap-1.5 rounded-md px-2.5 font-normal"
        >
          <SessionStatusIcon status={status} size={13} />
          {statusLabel(status)}
          <button
            type="button"
            aria-label={`Clear ${statusLabel(status)} filter`}
            onClick={() =>
              onFiltersChange({
                ...filters,
                statuses: toggle(filters.statuses, status),
              })
            }
          >
            <X className="hover:text-destructive size-3.5" />
          </button>
        </Badge>
      ))}

      <Popover open={groupOpen} onOpenChange={setGroupOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="text-muted-foreground ml-auto gap-1.5 rounded-md px-2.5 text-sm"
          >
            Group by:
            <span className="text-foreground">
              {groupBy === "status" ? "Status" : "Author"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent className="w-44 p-0" align="end">
            <Command>
              <CommandList>
                <CommandGroup>
                  {(["status", "author"] as const).map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        onGroupByChange(option);
                        setGroupOpen(false);
                      }}
                    >
                      <span className="flex-1 capitalize">{option}</span>
                      {groupBy === option && <Check size={14} />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </div>
  );
}
