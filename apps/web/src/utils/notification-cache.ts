export const NOTIFICATION_TYPES = [
  "agent_replied",
  "agent_waiting",
  "agent_failed",
  "human_replied",
  "mentioned",
  "delegation_received",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface PublishedNotification {
  id: string;
  type: NotificationType;
  threadId: string;
  projectId: string;
  channelSlug: string;
  preview: string;
  actorDisplay: string | null;
}

export function unreadCountKey() {
  return ["notifications", "unread-count"] as const;
}

export function applyUnreadDelta(
  previous: number | undefined,
  delta: number,
): number {
  return Math.max(0, (previous ?? 0) + delta);
}

function asType(value: unknown): NotificationType | null {
  if (typeof value !== "string") return null;
  return (NOTIFICATION_TYPES as readonly string[]).includes(value)
    ? (value as NotificationType)
    : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function parsePublishedNotification(
  data: unknown,
): PublishedNotification | null {
  if (typeof data !== "object" || data === null) return null;

  const envelope = data as { type?: unknown; notification?: unknown };
  if (envelope.type !== "notification") return null;
  if (
    typeof envelope.notification !== "object" ||
    envelope.notification === null
  ) {
    return null;
  }

  const raw = envelope.notification as Record<string, unknown>;
  const type = asType(raw.type);
  if (typeof raw.id !== "string" || raw.id.length === 0 || !type) return null;

  return {
    id: raw.id,
    type,
    threadId: asString(raw.threadId),
    projectId: asString(raw.projectId),
    channelSlug: asString(raw.channelSlug),
    preview: asString(raw.preview),
    actorDisplay:
      typeof raw.actorDisplay === "string" && raw.actorDisplay.length > 0
        ? raw.actorDisplay
        : null,
  };
}

export function notificationVerb(type: NotificationType): string {
  switch (type) {
    case "agent_replied":
      return "replied";
    case "agent_waiting":
      return "is waiting on another agent";
    case "agent_failed":
      return "could not finish";
    case "human_replied":
      return "replied";
    case "mentioned":
      return "mentioned you";
    case "delegation_received":
      return "was asked to help";
  }
}

export function notificationTitle(item: PublishedNotification): string {
  const actor = item.actorDisplay ?? "Your agent";
  return `${actor} ${notificationVerb(item.type)}`;
}

export function notificationBody(item: PublishedNotification): string {
  const preview = item.preview.trim();
  const channel = item.channelSlug ? `#${item.channelSlug}` : "";

  if (!preview) return channel || "Open Roster to see what changed.";
  return channel ? `${channel} · ${preview}` : preview;
}
