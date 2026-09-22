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
  previousHasThread = false,
): boolean {
  if (!previous) return true;
  // A thread affordance closes the message it hangs off. Whatever comes next
  // is a new remark, not another line of the one that started the thread.
  if (previousHasThread) return true;
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
