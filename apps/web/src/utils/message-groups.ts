const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface GroupableMessage {
  authorMemberId: string | null;
  agentChannelId?: string | null;
  createdAt: Date;
}

/**
 * Agent messages carry no author, so grouping on `authorMemberId` alone would
 * fold every agent into one speaker — and a delegated reply from fern [core]
 * sitting next to ash [spark]'s would silently lose its name header.
 */
function speaker(message: GroupableMessage): string | null {
  return message.authorMemberId ?? message.agentChannelId ?? null;
}

export function startsNewGroup(
  message: GroupableMessage,
  previous: GroupableMessage | undefined,
): boolean {
  if (!previous) return true;
  if (speaker(previous) !== speaker(message)) return true;
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
