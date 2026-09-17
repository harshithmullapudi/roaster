"use client";

import { TASK_STATUS_ORDER, type TaskStatus } from "@roster/api/client";
import {
  Button,
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
} from "@roster/ui";
import { Check } from "lucide-react";
import { useState } from "react";

import { TASK_STATUS_META, TaskStatusIcon, taskStatusColor } from "./task-status";

export interface StatusPickerProps {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  variant?: "pill" | "bare";
}

export function StatusPicker({
  value,
  onChange,
  variant = "pill",
}: StatusPickerProps) {
  const [open, setOpen] = useState(false);
  const meta = TASK_STATUS_META[value];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "bare" ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Status: ${meta.label}`}
            className="h-auto shrink-0 rounded-md bg-transparent p-0 hover:bg-transparent"
          >
            <TaskStatusIcon status={value} size={18} />
          </Button>
        ) : (
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="gap-1.5 rounded-full px-2.5 text-xs font-normal"
          >
            <TaskStatusIcon status={value} size={15} />
            {meta.label}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent className="w-52 p-0" align="start">
          <Command>
            <CommandList>
              <CommandGroup>
                {TASK_STATUS_ORDER.map((status) => (
                  <CommandItem
                    key={status}
                    value={TASK_STATUS_META[status].label}
                    onSelect={() => {
                      onChange(status);
                      setOpen(false);
                    }}
                  >
                    <TaskStatusIcon status={status} size={16} />
                    <span className="flex-1">
                      {TASK_STATUS_META[status].label}
                    </span>
                    {status === value && (
                      <Check
                        size={14}
                        className="ml-auto"
                        style={{ color: taskStatusColor(status).color }}
                      />
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
