import { RosterError } from "./client.js";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function systemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function wallClock(
  at: Date,
  timeZone: string,
): { date: string; hour: string; minute: string } {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(at);
  } catch {
    throw new RosterError(`Roster does not know the time zone "${timeZone}".`);
  }

  const read = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${read("year")}${read("month")}${read("day")}`,
    hour: read("hour"),
    minute: read("minute"),
  };
}

export function withStart(
  rule: string,
  at: string | undefined,
  timeZone: string,
  now: Date = new Date(),
): string {
  const trimmed = rule.trim();

  if (/dtstart/i.test(trimmed)) {
    if (at) {
      throw new RosterError(
        "That rule already carries a DTSTART, so --at has nothing to set.",
      );
    }
    return trimmed;
  }

  const body = trimmed.replace(/^rrule:/i, "");
  const clock = wallClock(now, timeZone);

  let hour = clock.hour;
  let minute = clock.minute;

  if (at) {
    const parsed = TIME.exec(at.trim());
    if (!parsed) {
      throw new RosterError(
        `--at wants a 24-hour time like 17:00, not "${at}".`,
      );
    }
    [, hour, minute] = parsed as unknown as [string, string, string];
  }

  return `DTSTART:${clock.date}T${hour}${minute}00\nRRULE:${body}`;
}
