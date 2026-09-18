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
  if (email) return email.split("@")[0] || email;
  return "Unknown";
}

export interface SpeakerMessage {
  kind: string;
  authorName: string | null;
  authorEmail: string | null;
  agentDisplay: string | null;
}

/**
 * The one name a speaker gets. Avatar colours are a hash of this string, so
 * every place that draws an avatar for the same person must derive it the same
 * way — a row that hashed the full address and a reply stack that hashed the
 * local part gave one person two colours.
 *
 * `replierNames` in `services/sessions/queries` builds the same string in SQL.
 */
export function speakerName(message: SpeakerMessage): string {
  if (message.kind === "user") {
    return displayName(message.authorName, message.authorEmail);
  }
  return message.agentDisplay ?? "Agent";
}
