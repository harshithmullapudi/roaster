import { members, messages, projects, users } from "@roster/db";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { agentDisplay, agentHandle } from "../lib/agent-identity";

export interface ChannelMessage {
  id: string;
  projectId: string;
  seq: number;
  kind: string;
  body: unknown;
  text: string;
  clientId: string | null;
  parentMessageId: string | null;
  threadId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  authorMemberId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  agentChannelId: string | null;
  agentDisplay: string | null;
  agentHandle: string | null;
}

export const agentChannel = alias(projects, "agent_channel");
export const agentOwner = alias(members, "agent_owner");

export const AGENT_IDENTITY_ON = {
  channel: eq(messages.agentChannelId, agentChannel.id),
  owner: eq(agentChannel.addedByMemberId, agentOwner.id),
} as const;

export const messageColumns = {
  id: messages.id,
  projectId: messages.projectId,
  seq: messages.seq,
  kind: messages.kind,
  body: messages.body,
  text: messages.text,
  clientId: messages.clientId,
  parentMessageId: messages.parentMessageId,
  threadId: messages.threadId,
  createdAt: messages.createdAt,
  editedAt: messages.editedAt,
  authorMemberId: messages.authorMemberId,
  authorName: users.name,
  authorEmail: users.email,
  agentChannelId: messages.agentChannelId,
  agentChannelSlug: agentChannel.slug,
  agentOwnerName: agentOwner.agentName,
};

export interface MessageRow {
  id: string;
  projectId: string;
  seq: number;
  kind: string;
  body: unknown;
  text: string;
  clientId: string | null;
  parentMessageId: string | null;
  threadId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  authorMemberId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  agentChannelId: string | null;
  agentChannelSlug: string | null;
  agentOwnerName: string | null;
}

export function toChannelMessage(row: MessageRow): ChannelMessage {
  const { agentChannelSlug, agentOwnerName, ...rest } = row;

  return {
    ...rest,
    seq: Number(row.seq),
    agentDisplay: agentChannelSlug
      ? agentDisplay(agentOwnerName, agentChannelSlug)
      : null,
    agentHandle: agentChannelSlug
      ? agentHandle(agentOwnerName, agentChannelSlug)
      : null,
  };
}
