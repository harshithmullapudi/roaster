import type { NotificationItem } from "@roster/api";

export type NotificationType = NotificationItem["type"];

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "agent_replied",
  "agent_waiting",
  "agent_failed",
  "human_replied",
  "mentioned",
  "delegation_received",
];

export const NOTIFICATION_CACHE_LIMIT = 50;

export function notificationsKey() {
  return ["notifications", "list"] as const;
}

export function unreadCountKey() {
  return ["notifications", "unread-count"] as const;
}

export function notificationLabel(type: NotificationType): string {
  switch (type) {
    case "agent_replied":
      return "Agent replied";
    case "agent_waiting":
      return "Agent is waiting";
    case "agent_failed":
      return "Agent failed";
    case "human_replied":
      return "New reply";
    case "mentioned":
      return "Mentioned you";
    case "delegation_received":
      return "Handed to you";
    default:
      return "Notification";
  }
}

export function sortNotifications(
  list: NotificationItem[],
): NotificationItem[] {
  return [...list].sort((a, b) => {
    const delta = b.createdAt.getTime() - a.createdAt.getTime();
    if (delta !== 0) return delta;
    return b.id.localeCompare(a.id);
  });
}

export function prependNotification(
  list: NotificationItem[],
  incoming: NotificationItem,
): NotificationItem[] {
  if (list.some((item) => item.id === incoming.id)) return list;
  return sortNotifications([incoming, ...list]).slice(
    0,
    NOTIFICATION_CACHE_LIMIT,
  );
}

export function markNotificationRead(
  list: NotificationItem[],
  notificationId: string,
  readAt: Date = new Date(),
): NotificationItem[] {
  const index = list.findIndex((item) => item.id === notificationId);
  if (index === -1) return list;

  const item = list[index];
  if (!item || item.readAt) return list;

  const next = [...list];
  next[index] = { ...item, readAt };
  return next;
}

export function markAllNotificationsRead(
  list: NotificationItem[],
  readAt: Date = new Date(),
): NotificationItem[] {
  if (!list.some((item) => item.readAt === null)) return list;
  return list.map((item) => (item.readAt ? item : { ...item, readAt }));
}

export function unreadCount(list: NotificationItem[]): number {
  return list.reduce((total, item) => (item.readAt ? total : total + 1), 0);
}

export function applyUnreadDelta(
  previous: number | undefined,
  delta: number,
): number {
  return Math.max(0, (previous ?? 0) + delta);
}

export function unreadBadge(count: number, max = 9): string | null {
  if (count <= 0) return null;
  return count > max ? `${max}+` : String(count);
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asType(value: unknown): NotificationType | null {
  if (typeof value !== "string") return null;
  return (NOTIFICATION_TYPES as readonly string[]).includes(value)
    ? (value as NotificationType)
    : null;
}

export function parsePublishedNotification(
  data: unknown,
): NotificationItem | null {
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
  const createdAt = asDate(raw.createdAt);
  if (
    typeof raw.id !== "string" ||
    typeof raw.threadId !== "string" ||
    typeof raw.projectId !== "string" ||
    typeof raw.channelSlug !== "string" ||
    !type ||
    !createdAt
  ) {
    return null;
  }

  return {
    id: raw.id,
    type,
    threadId: raw.threadId,
    projectId: raw.projectId,
    channelSlug: raw.channelSlug,
    channelName:
      typeof raw.channelName === "string" ? raw.channelName : raw.channelSlug,
    messageId: typeof raw.messageId === "string" ? raw.messageId : null,
    rootText: typeof raw.rootText === "string" ? raw.rootText : "",
    preview: typeof raw.preview === "string" ? raw.preview : "",
    actorDisplay:
      typeof raw.actorDisplay === "string" ? raw.actorDisplay : null,
    readAt: null,
    createdAt,
  };
}

export function threadHref(
  orgSlug: string,
  item: Pick<NotificationItem, "channelSlug" | "threadId">,
): string {
  return `/${orgSlug}/${item.channelSlug}/thread/${item.threadId}`;
}
