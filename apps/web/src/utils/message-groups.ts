const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface GroupableMessage {
  authorMemberId: string | null;
  createdAt: Date;
}

export function startsNewGroup(
  message: GroupableMessage,
  previous: GroupableMessage | undefined,
): boolean {
  if (!previous) return true;
  if (previous.authorMemberId !== message.authorMemberId) return true;
  return (
    message.createdAt.getTime() - previous.createdAt.getTime() >
    GROUP_WINDOW_MS
  );
}

export function displayName(
  name: string | null,
  email: string | null,
): string {
  if (name && name.trim().length > 0) return name;
  if (email) return email;
  return "Unknown";
}
