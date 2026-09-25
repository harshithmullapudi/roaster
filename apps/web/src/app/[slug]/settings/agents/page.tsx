import { listAgents } from "@roster/api";

import { AgentManager } from "~/components/agents/agent-manager";
import { SettingsPage } from "~/components/settings/settings-page";
import { loadShell } from "~/lib/shell";

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { organization, member, shell } = await loadShell(slug);

  const agents = await listAgents({
    organizationId: organization.id,
    memberId: member.id,
    role: member.role,
  });

  const { channels } = shell;
  const flat = [...channels.starred, ...channels.public, ...channels.private]
    .map((channel) => ({ id: channel.id, slug: channel.slug }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return (
    <SettingsPage
      title="Agents"
      description="Who answers in each channel, and what each one is there to do."
    >
      <AgentManager agents={agents} channels={flat} />
    </SettingsPage>
  );
}
