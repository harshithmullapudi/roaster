import type { NotificationType } from "@roster/db";

export const PREVIEW_LENGTH = 140;

export interface NotificationEvent {
  kind: string;
  parentMessageId: string | null;
  causedByMemberId: string | null;
  mentionedMemberIds: string[];
  leadStatus: string | null;
  outcome?: NotificationType | null;
}

export interface ThreadSubscriber {
  memberId: string;
  mutedAt: Date | null;
}

export interface PlannedNotification {
  memberId: string;
  type: NotificationType;
}

function agentOutcome(leadStatus: string | null): NotificationType {
  if (leadStatus === "waiting") return "agent_waiting";
  if (leadStatus === "failed") return "agent_failed";
  return "agent_replied";
}

export function notificationTypeFor(
  event: NotificationEvent,
  recipientMemberId: string,
): NotificationType | null {
  if (event.mentionedMemberIds.includes(recipientMemberId)) return "mentioned";
  if (event.kind === "agent") {
    return event.outcome ?? agentOutcome(event.leadStatus);
  }
  if (event.kind === "user" && event.parentMessageId !== null) {
    return "human_replied";
  }
  return null;
}

export function notifiableMembers(
  subscribers: ThreadSubscriber[],
  causedByMemberId: string | null,
): string[] {
  const kept: string[] = [];
  const seen = new Set<string>();

  for (const subscriber of subscribers) {
    if (subscriber.mutedAt !== null) continue;
    if (subscriber.memberId === causedByMemberId) continue;
    if (seen.has(subscriber.memberId)) continue;
    seen.add(subscriber.memberId);
    kept.push(subscriber.memberId);
  }

  return kept;
}

export function planNotifications(args: {
  event: NotificationEvent;
  subscribers: ThreadSubscriber[];
}): PlannedNotification[] {
  const planned: PlannedNotification[] = [];

  for (const memberId of notifiableMembers(
    args.subscribers,
    args.event.causedByMemberId,
  )) {
    const type = notificationTypeFor(args.event, memberId);
    if (type) planned.push({ memberId, type });
  }

  return planned;
}

export function previewOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= PREVIEW_LENGTH) return flat;
  return `${flat.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…`;
}
