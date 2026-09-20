export function unreadCountKey() {
  return ["notifications", "unread-count"] as const;
}

export function applyUnreadDelta(
  previous: number | undefined,
  delta: number,
): number {
  return Math.max(0, (previous ?? 0) + delta);
}

export function hasUnread(count: number | undefined): boolean {
  return (count ?? 0) > 0;
}

export function publishedNotificationId(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;

  const envelope = data as { type?: unknown; notification?: unknown };
  if (envelope.type !== "notification") return null;
  if (
    typeof envelope.notification !== "object" ||
    envelope.notification === null
  ) {
    return null;
  }

  const { id } = envelope.notification as { id?: unknown };
  return typeof id === "string" && id.length > 0 ? id : null;
}
