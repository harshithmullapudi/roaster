const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface GroupableMessage {
  authorMemberId: string | null;
  agentChannelId?: string | null;
  createdAt: Date;
}

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
  if (email) return email.split("@")[0] || email;
  return "Unknown";
}

export interface SpeakerMessage {
  kind: string;
  authorName: string | null;
  authorEmail: string | null;
  agentDisplay: string | null;
}

export function speakerName(message: SpeakerMessage): string {
  if (message.kind === "user") {
    return displayName(message.authorName, message.authorEmail);
  }
  return message.agentDisplay ?? "Agent";
}
