import { getChannelBySlug, listChannels, listMessages } from "@roster/api";
import { notFound } from "next/navigation";

import { AppShell } from "~/components/app-shell/app-shell";
import { ChannelPlaceholder } from "~/components/channels/channel-placeholder";
import { ChannelTabs } from "~/components/channels/channel-tabs";
import { MessagePanel } from "~/components/messages/message-panel";
import { myOrganizations, requireOrg } from "~/lib/session";
import type { ChannelTab } from "~/types";

const TABS: ChannelTab[] = ["messages", "tasks", "memory", "running"];

const EMPTY_STATES: Record<string, { title: string; description: string }> = {
  tasks: {
    title: "No tasks yet",
    description: "Tasks raised in this channel will collect here.",
  },
  memory: {
    title: "Nothing remembered yet",
    description: "What the channel learns will show up here.",
  },
  running: {
    title: "Nothing running",
    description: "Active agent runs for this channel will appear here.",
  },
};

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; channelSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug, channelSlug } = await params;
  const { tab } = await searchParams;
  const { session, organization, member } = await requireOrg(slug);

  const channel = await getChannelBySlug({
    organizationId: organization.id,
    memberId: member.id,
    slug: channelSlug,
  });
  if (!channel) notFound();

  const activeTab: ChannelTab = TABS.includes(tab as ChannelTab)
    ? (tab as ChannelTab)
    : "messages";

  const [organizations, channels, messages] = await Promise.all([
    myOrganizations(session.user.id),
    listChannels({ organizationId: organization.id, memberId: member.id }),
    listMessages({ projectId: channel.id, limit: 50 }),
  ]);

  const placeholder = EMPTY_STATES[activeTab];

  return (
    <AppShell
      activeOrg={organization}
      organizations={organizations}
      user={session.user}
      section="channels"
      channels={channels}
      activeChannelSlug={channel.slug}
      title={
        <span className="flex items-baseline gap-1">
          <span className="text-muted-foreground">#</span>
          {channel.slug}
        </span>
      }
      tabs={
        <ChannelTabs
          basePath={`/${organization.slug}/${channel.slug}`}
          active={activeTab}
        />
      }
      flush
    >
      {placeholder ? (
        <ChannelPlaceholder
          title={placeholder.title}
          description={placeholder.description}
        />
      ) : (
        <MessagePanel
          projectId={channel.id}
          channelName={channel.slug}
          authorName={session.user.name}
          authorEmail={session.user.email}
          initialMessages={messages}
        />
      )}
    </AppShell>
  );
}
