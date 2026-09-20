import type { ChannelMessage } from "@roster/api";

export interface MessageItem extends ChannelMessage {
  pending?: boolean;
  failed?: boolean;
}

export type ChannelTab = "messages" | "tasks" | "memory";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export type SidebarSection = "channels" | "members" | "tasks" | "threads";
