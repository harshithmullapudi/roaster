import * as rruleModule from "rrule";

const rrule = (rruleModule as unknown as { default?: typeof rruleModule })
  .default ?? rruleModule;

const { RRule, rrulestr } = rrule;
type RRule = InstanceType<typeof RRule>;

export class RecurrenceError extends Error {}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let found = formatters.get(timeZone);
  if (!found) {
    try {
      found = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      throw new RecurrenceError(`Unknown time zone "${timeZone}".`);
    }
    formatters.set(timeZone, found);
  }
  return found;
}

function wallClockMs(instant: Date, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
    instant.getUTCMilliseconds(),
  );
}

function offsetMs(instant: Date, timeZone: string): number {
  return wallClockMs(instant, timeZone) - instant.getTime();
}

function toWallClock(instant: Date, timeZone: string): Date {
  return new Date(wallClockMs(instant, timeZone));
}

function fromWallClock(wall: Date, timeZone: string): Date {
  const firstGuess = new Date(wall.getTime() - offsetMs(wall, timeZone));
  return new Date(wall.getTime() - offsetMs(firstGuess, timeZone));
}

export function parseRecurrence(rule: string): RRule {
  const trimmed = rule.trim();
  if (!trimmed) throw new RecurrenceError("Give the schedule a rule.");

  let parsed;
  try {
    parsed = rrulestr(trimmed, { forceset: false });
  } catch (cause) {
    throw new RecurrenceError(
      `That is not a recurrence rule Roster understands: ${(cause as Error).message}`,
    );
  }

  if (!(parsed instanceof RRule)) {
    throw new RecurrenceError("A schedule takes one rule, not a set of them.");
  }
  if (parsed.options.freq === undefined || parsed.options.freq === null) {
    throw new RecurrenceError("A rule needs a frequency, such as FREQ=WEEKLY.");
  }

  return parsed;
}

export function describeRecurrence(rule: string): string {
  return parseRecurrence(rule).toText();
}

const HAS_START = /dtstart/i;

function anchored(rule: string, timezone: string, anchor?: Date): RRule {
  const parsed = parseRecurrence(rule);
  if (HAS_START.test(rule) || !anchor) return parsed;

  return new RRule({
    ...parsed.origOptions,
    dtstart: toWallClock(anchor, timezone),
  });
}

export function nextOccurrence(args: {
  rule: string;
  timezone: string;
  after: Date;
  anchor?: Date;
}): Date | null {
  const parsed = anchored(args.rule, args.timezone, args.anchor);
  const wall = parsed.after(toWallClock(args.after, args.timezone), false);

  return wall ? fromWallClock(wall, args.timezone) : null;
}

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type Frequency = "daily" | "weekly" | "monthly";

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function floatingStart(localInput: string): string {
  const parts = LOCAL_INPUT.exec(localInput.trim());
  if (!parts) {
    throw new RecurrenceError(
      "Give the schedule a start like 2026-09-24T09:00.",
    );
  }

  const [, year, month, day, hour, minute] = parts;
  return `${year}${month}${day}T${hour}${minute}00`;
}

export function onceAt(localInput: string): string {
  return `DTSTART:${floatingStart(localInput)}\nRRULE:FREQ=DAILY;COUNT=1`;
}

export function buildRecurrence(draft: {
  startLocal: string;
  freq: Frequency;
  interval: number;
  weekdays: Weekday[];
}): string {
  const terms = [`FREQ=${draft.freq.toUpperCase()}`];

  if (draft.interval > 1) terms.push(`INTERVAL=${draft.interval}`);
  if (draft.freq === "weekly" && draft.weekdays.length > 0) {
    terms.push(`BYDAY=${draft.weekdays.join(",")}`);
  }

  return `DTSTART:${floatingStart(draft.startLocal)}\nRRULE:${terms.join(";")}`;
}
