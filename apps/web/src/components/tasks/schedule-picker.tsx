"use client";

import {
  buildRecurrence,
  describeRecurrence,
  onceAt,
  RecurrenceError,
  WEEKDAYS,
  type Frequency,
  type Weekday,
} from "@roster/api/client";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverTrigger,
  cn,
} from "@roster/ui";
import { Clock } from "lucide-react";
import { useMemo, useState } from "react";

export type ScheduleValue =
  | { kind: "now" }
  | { kind: "once"; startLocal: string }
  | {
      kind: "repeat";
      startLocal: string;
      freq: Frequency;
      interval: number;
      weekdays: Weekday[];
    };

export interface SchedulePickerProps {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MO: "M",
  TU: "T",
  WE: "W",
  TH: "T",
  FR: "F",
  SA: "S",
  SU: "S",
};

const FREQUENCIES: Array<{ value: Frequency; label: string }> = [
  { value: "daily", label: "day" },
  { value: "weekly", label: "week" },
  { value: "monthly", label: "month" },
];

export function defaultStartLocal(): string {
  const at = new Date(Date.now() + 60 * 60 * 1000);
  at.setMinutes(0, 0, 0);

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function ruleFor(value: ScheduleValue): string | null {
  if (value.kind === "now") return null;
  if (value.kind === "once") return onceAt(value.startLocal);

  return buildRecurrence({
    startLocal: value.startLocal,
    freq: value.freq,
    interval: value.interval,
    weekdays: value.weekdays,
  });
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function summarise(value: ScheduleValue): string {
  if (value.kind === "now") return "Now";
  if (value.kind === "once") {
    return `Once, ${value.startLocal.replace("T", " ")}`;
  }

  try {
    const rule = ruleFor(value);
    return rule ? describeRecurrence(rule) : "Repeating";
  } catch (cause) {
    return cause instanceof RecurrenceError ? "Invalid rule" : "Repeating";
  }
}

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const [open, setOpen] = useState(false);
  const label = useMemo(() => summarise(value), [value]);

  const startLocal =
    value.kind === "now" ? defaultStartLocal() : value.startLocal;

  function choose(kind: ScheduleValue["kind"]) {
    if (kind === "now") {
      onChange({ kind: "now" });
      setOpen(false);
      return;
    }

    if (kind === "once") {
      onChange({ kind: "once", startLocal });
      return;
    }

    onChange({
      kind: "repeat",
      startLocal,
      freq: "weekly",
      interval: 1,
      weekdays: [],
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="gap-1.5 rounded-full px-2.5 text-xs font-normal"
        >
          <Clock size={13} />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="flex gap-1">
            {(["now", "once", "repeat"] as const).map((kind) => (
              <Button
                key={kind}
                variant={value.kind === kind ? "secondary" : "ghost"}
                className="h-7 flex-1 text-xs"
                onClick={() => choose(kind)}
              >
                {kind === "now" ? "Now" : kind === "once" ? "Once at" : "Repeating"}
              </Button>
            ))}
          </div>

          {value.kind !== "now" && (
            <div className="mt-2 flex flex-col gap-2">
              <label className="text-muted-foreground flex flex-col gap-1 text-xs">
                Starts
                <Input
                  type="datetime-local"
                  value={value.startLocal}
                  onChange={(event) =>
                    onChange({ ...value, startLocal: event.target.value })
                  }
                  className="h-8 text-xs"
                />
              </label>

              {value.kind === "repeat" && (
                <>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Every</span>
                    <Input
                      type="number"
                      min={1}
                      max={52}
                      value={value.interval}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          interval: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      className="h-8 w-14 text-xs"
                    />
                    {FREQUENCIES.map((option) => (
                      <Button
                        key={option.value}
                        variant={
                          value.freq === option.value ? "secondary" : "ghost"
                        }
                        className="h-8 px-2 text-xs"
                        onClick={() => onChange({ ...value, freq: option.value })}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>

                  {value.freq === "weekly" && (
                    <div className="flex gap-1">
                      {WEEKDAYS.map((day) => {
                        const on = value.weekdays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            aria-label={day}
                            aria-pressed={on}
                            onClick={() =>
                              onChange({
                                ...value,
                                weekdays: on
                                  ? value.weekdays.filter((d) => d !== day)
                                  : [...value.weekdays, day],
                              })
                            }
                            className={cn(
                              "h-7 w-7 rounded text-xs",
                              on
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {WEEKDAY_LABELS[day]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              <p className="text-muted-foreground text-xs">{label}</p>
            </div>
          )}
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
