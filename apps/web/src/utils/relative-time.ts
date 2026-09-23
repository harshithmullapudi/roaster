const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(value: Date, now: Date = new Date()): string {
  const delta = now.getTime() - value.getTime();

  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function clockTime(value: Date): string {
  return value.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function elapsedLabel(startedAt: Date, endedAt: Date | null): string {
  const end = endedAt ?? new Date();
  const seconds = Math.max(
    0,
    Math.round((end.getTime() - startedAt.getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
